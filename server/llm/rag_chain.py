from langchain_core.documents.base import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from config.settings import settings
from prompts.rag_prompt import RAG_PROMPT
from retrieval.retriever import search_college_knowledge_base


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
        source = doc.metadata.get("source_file", "Unknown")
        page = doc.metadata.get("page", 0)
        formatted_chunks.append(
            f"[{i}] Source: {source} | Page: {page + 1}\n{doc.page_content.strip()}"
        )
    return "\n\n---\n\n".join(formatted_chunks)


def build_rag_chain(college_slug: str, top_k: int = 4):
    """
    Builds and returns a stateless (memoryless) LCEL RAG chain for a specific college.

    Chain flow:
        question → retriever → format context → RAG prompt → LLM → string output
    
    Input:  {"question": str}
    Output: str (the LLM's answer with citations)
    """

    def retrieve_and_format(inputs: dict) -> dict:
        """Retrieves docs and formats them, then passes everything to the prompt."""
        question = inputs["question"]
        docs = search_college_knowledge_base(question, college_slug, top_k=top_k)
        return {
            "context": _format_context(docs),
            "question": question,
            "college_slug": college_slug,
        }

    chain = (
        RunnableLambda(retrieve_and_format)
        | RAG_PROMPT
        | settings.llm_model
        | StrOutputParser()
    )

    return chain


def ask(question: str, college_slug: str, top_k: int = 4) -> str:
    """
    Convenience function: builds the chain and answers a single question.
    Streams the response to stdout token-by-token and returns the full answer string.
    """
    chain = build_rag_chain(college_slug, top_k=top_k)

    print("\n[RAG] Generating answer...\n")
    full_answer = ""
    for chunk in chain.stream({"question": question}):
        print(chunk, end="", flush=True)
        full_answer += chunk

    print("\n")
    return full_answer
