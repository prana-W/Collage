import logging
import json
from pydantic import BaseModel, Field
from langchain_core.documents.base import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langsmith import traceable
from config.settings import settings
from prompts.rag_prompt import RAG_PROMPT, RAG_SYSTEM_PROMPT
from retrieval.retriever import search_college_knowledge_base
from llm.query_enhancer import enhance_query
from utils.token_counter import count_tokens, TokenAudit
from db.crud import record_token_usage

logger = logging.getLogger(__name__)


class RAGResponse(BaseModel):
    """Structured response model for LLM RAG queries."""
    content: str = Field(
        ..., 
        description="Detailed, structured answer in markdown format addressing the question using bold text (**), bullet points, and headers."
    )
    sources: list[str] = Field(
        default_factory=list, 
        description="List of unique source URLs or PDF document filenames referenced to produce this answer."
    )


import re

def extract_used_sources(docs: list[Document], llm_output: str = None) -> list[str]:
    """
    Extracts unique source URLs or PDF filenames from retrieved documents.
    If llm_output is provided, filters sources to only include those for chunks [i]
    that were actually cited (e.g. [1], [2]) or referenced in the LLM output.
    """
    if not docs:
        return []

    # Map chunk index (1-based) to source name
    chunk_source_map = {}
    for i, doc in enumerate(docs, 1):
        raw_src = doc.metadata.get("source_url") or doc.metadata.get("source_file") or doc.metadata.get("source") or ""
        src = raw_src.strip() if isinstance(raw_src, str) else str(raw_src).strip()
        if src and src != "Unknown":
            chunk_source_map[i] = src

    if not llm_output:
        sources = []
        seen = set()
        for src in chunk_source_map.values():
            if src.lower() not in seen:
                seen.add(src.lower())
                sources.append(src)
        return sources

    # Parse cited chunk indices like [1], [2] from llm_output
    cited_indices = set()
    matches = re.findall(r'\[(\d+)\]', llm_output)
    for m in matches:
        try:
            idx = int(m)
            if idx in chunk_source_map:
                cited_indices.add(idx)
        except ValueError:
            pass

    used_sources = []
    seen = set()

    if cited_indices:
        for idx in sorted(cited_indices):
            src = chunk_source_map[idx]
            if src.lower() not in seen:
                seen.add(src.lower())
                used_sources.append(src)
    else:
        # Fallback 1: check if source filename/URL is explicitly mentioned in text
        for src in chunk_source_map.values():
            src_filename = src.split("/")[-1]
            if (src.lower() in llm_output.lower() or src_filename.lower() in llm_output.lower()) and src.lower() not in seen:
                seen.add(src.lower())
                used_sources.append(src)

        # Fallback 2: if LLM didn't use inline [n] numbers or filenames, but gave an answer (not a "not found" fallback),
        # return unique sources from docs
        if not used_sources and "could not find relevant information" not in llm_output.lower():
            for src in chunk_source_map.values():
                if src.lower() not in seen:
                    seen.add(src.lower())
                    used_sources.append(src)

    return used_sources


def extract_sources_from_docs(docs: list[Document]) -> list[str]:
    """Backward compatibility alias."""
    return extract_used_sources(docs)


def _format_context(docs: list[Document]) -> str:
    """
    Formats retrieved chunks into a numbered, citation-ready context string.
    Each chunk is prefixed with its source filename and page number so the LLM
    can reference them when citing sources in its answer.
    """
    if not docs:
        return "NO_RELEVANT_DOCUMENTS_FOUND: The vector search returned 0 relevant document chunks from the uploaded knowledge base."

    formatted_chunks = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source_url") or doc.metadata.get("source_file", "Unknown")
        page = doc.metadata.get("page", 0)
        formatted_chunks.append(
            f"[{i}] Source: {source} | Page: {page + 1}\n{doc.page_content.strip()}"
        )
    return "\n\n---\n\n".join(formatted_chunks)


@traceable(name="Structured RAG Query", run_type="chain")
def query_rag_structured(question: str, college_slug: str, top_k: int = 4, chat_history: list = None) -> RAGResponse:
    """
    Executes RAG pipeline and returns a structured RAGResponse object containing
    content and sources list.
    """
    enhanced_question = enhance_query(question, chat_history=chat_history)
    docs = search_college_knowledge_base(enhanced_question, college_slug, top_k=top_k)
    formatted_context = _format_context(docs)

    prompt_messages = RAG_PROMPT.format_messages(
        college_slug=college_slug,
        context=formatted_context,
        question=enhanced_question
    )

    response = settings.llm_model.invoke(prompt_messages)
    content_str = response.content if hasattr(response, "content") else str(response)
    sources = extract_used_sources(docs, llm_output=content_str)

    return RAGResponse(content=content_str, sources=sources)


@traceable(name="Build RAG Chain", run_type="chain")
def build_rag_chain(college_slug: str, top_k: int = 4):
    """
    Builds and returns a stateless LCEL RAG chain for a specific college.
    """

    def process_and_retrieve(inputs: dict) -> dict:
        raw_question = inputs["question"]
        chat_history = inputs.get("chat_history")
        enhanced_question = enhance_query(raw_question, chat_history=chat_history)
        docs = search_college_knowledge_base(enhanced_question, college_slug, top_k=top_k)
        
        return {
            "context": _format_context(docs),
            "question": enhanced_question,
            "college_slug": college_slug,
            "sources": extract_used_sources(docs)
        }

    chain = (
        RunnableLambda(process_and_retrieve)
        | RAG_PROMPT
        | settings.llm_model
        | StrOutputParser()
    )

    return chain


@traceable(name="Streaming RAG Query", run_type="chain")
def stream_rag_with_token_audit(
    question: str, 
    college_slug: str, 
    top_k: int = 4, 
    user_id: int = None,
    chat_history: list = None
):
    """
    Generator that streams LLM tokens in real-time, records token metrics across
    all 4 stages, and appends a JSON audit payload containing sources & token metrics at the end.
    """
    audit = TokenAudit()

    # Stage 1: Query Enhancement
    enhanced_question = enhance_query(question, chat_history=chat_history, audit=audit)

    # Stage 2: Embedding Search
    docs = search_college_knowledge_base(enhanced_question, college_slug, top_k=top_k)
    audit.embedding_tokens = count_tokens(enhanced_question)

    # Stage 3: Context Formatting & RAG Prompt Token Count
    formatted_context = _format_context(docs)
    prompt_payload = f"{RAG_SYSTEM_PROMPT.format(college_slug=college_slug, context=formatted_context)}\n{enhanced_question}"
    audit.rag_prompt_tokens = count_tokens(prompt_payload)

    # Stage 4: LLM Generation & Streamed Token Audit
    prompt_messages = RAG_PROMPT.format_messages(
        college_slug=college_slug,
        context=formatted_context,
        question=enhanced_question
    )

    full_completion_text = ""
    for chunk in settings.llm_model.stream(prompt_messages):
        token_str = chunk.content if hasattr(chunk, "content") else str(chunk)
        full_completion_text += token_str
        audit.rag_completion_tokens += count_tokens(token_str)
        yield token_str

    # Extract ONLY sources actually cited in full_completion_text
    sources = extract_used_sources(docs, llm_output=full_completion_text)

    # Persist token count in Database
    new_user_total = 0
    if user_id is not None:
        new_user_total = record_token_usage(user_id=user_id, college_slug=college_slug, tokens_count=audit.total_tokens)

    # Log summary in server terminal
    logger.info(
        f"[TokenAudit] Query for '{college_slug}' completed | "
        f"Enhancer: {audit.enhancer_prompt_tokens + audit.enhancer_completion_tokens} | "
        f"Embedding: {audit.embedding_tokens} | "
        f"RAG Context: {audit.rag_prompt_tokens} | "
        f"RAG Stream: {audit.rag_completion_tokens} | "
        f"TOTAL: {audit.total_tokens} tokens (User Total: {new_user_total})"
    )

    # Include sources and user's cumulative total tokens in the output JSON dictionary
    audit_dict = audit.to_dict()
    audit_dict["user_cumulative_total"] = new_user_total
    audit_dict["sources"] = sources

    # Append JSON payload at end of stream for frontend display
    yield f"\n\n__TOKEN_USAGE__:{json.dumps(audit_dict)}"


def ask(question: str, college_slug: str, top_k: int = 4, chat_history: list = None) -> str:
    """
    Convenience function: builds the chain and answers a single question.
    """
    chain = build_rag_chain(college_slug, top_k=top_k)

    print("\n[RAG] Generating answer...\n")
    full_answer = ""
    for chunk in chain.stream({"question": question, "chat_history": chat_history}):
        print(chunk, end="", flush=True)
        full_answer += chunk

    print("\n")
    return full_answer

