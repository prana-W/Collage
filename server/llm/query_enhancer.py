import logging
from typing import Any, List, Optional, Literal
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langsmith import traceable
from config.settings import settings
from utils.token_counter import count_tokens, TokenAudit

logger = logging.getLogger(__name__)


class QueryAnalysis(BaseModel):
    enhanced_query: str = Field(
        ...,
        description="The rewritten, standalone version of the user query with typos fixed and context references resolved."
    )
    intent: Literal["INSTITUTE_RAG", "APP_META", "OUT_OF_BOUNDS"] = Field(
        ...,
        description=(
            "Classification of intent:\n"
            "- 'INSTITUTE_RAG': Queries related to college/institute (courses, syllabus, fees, admissions, hostel, campus, dates, faculty, placements, etc.).\n"
            "- 'APP_META': Greetings ('hi', 'hello'), or questions about the application itself (who made this app, what can it do, how to use it).\n"
            "- 'OUT_OF_BOUNDS': General knowledge, code generation requests ('write code for...'), math, essays, or non-institute topics."
        )
    )


QUERY_ENHANCER_SYSTEM_PROMPT = """\
You are an expert NLP query rewriter and intent classifier for an academic institute search engine.
Your task is to analyze the conversation history and the user's latest query, and produce a JSON object containing:
1. "enhanced_query": The rewritten, standalone version of the query with spelling/grammar fixed and context resolved.
2. "intent": One of ["INSTITUTE_RAG", "APP_META", "OUT_OF_BOUNDS"]

CLASSIFICATION CRITERIA:
- "INSTITUTE_RAG": Use this for any question about college/institute (e.g. syllabus, exams, courses, admission, fee structure, hostel, campus, faculty, placements, transport, etc.).
- "APP_META": Use this for greetings (e.g., "Hi", "Hello", "How are you?") OR questions about this application itself (e.g., "Who made this app?", "What can this app do?", "How do I use this website?").
- "OUT_OF_BOUNDS": Use this for code generation requests (e.g., "write python code for binary search"), homework help, essays, math problems, or general trivia unrelated to the institute/app.

REWRITING RULES:
1. Resolve pronouns ('its', 'this', 'that') using prior chat history into a complete standalone question.
2. Fix typos and spelling mistakes.
3. Preserve core meaning.
"""

parser = JsonOutputParser(pydantic_object=QueryAnalysis)

ENHANCER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", QUERY_ENHANCER_SYSTEM_PROMPT + "\n\n{format_instructions}"),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{query}"),
])

# LangChain LCEL chain for query enhancement & intent classification
query_enhancer_chain = ENHANCER_PROMPT | settings.llm_model | parser


def _convert_chat_history(chat_history: Optional[List[Any]]) -> List[BaseMessage]:
    """
    Converts input chat history (dicts, objects, or BaseMessage instances) into
    LangChain HumanMessage and AIMessage list.
    """
    messages: List[BaseMessage] = []
    if not chat_history:
        return messages

    for msg in chat_history:
        if isinstance(msg, BaseMessage):
            messages.append(msg)
        elif isinstance(msg, dict):
            role = str(msg.get("role", "")).lower()
            content = str(msg.get("content") or msg.get("text") or "").strip()
            if not content:
                continue
            if role in ("user", "human"):
                messages.append(HumanMessage(content=content))
            elif role in ("assistant", "ai", "bot"):
                messages.append(AIMessage(content=content))
        elif hasattr(msg, "role"):
            role = str(getattr(msg, "role", "")).lower()
            content = str(getattr(msg, "content", "") or getattr(msg, "text", "")).strip()
            if not content:
                continue
            if role in ("user", "human"):
                messages.append(HumanMessage(content=content))
            elif role in ("assistant", "ai", "bot"):
                messages.append(AIMessage(content=content))
    return messages


@traceable(name="Query Enhancement & Routing", run_type="chain")
def analyze_and_enhance_query(
    query: str, 
    chat_history: Optional[List[Any]] = None, 
    audit: Optional[TokenAudit] = None
) -> tuple[str, str]:
    """
    Takes a raw user query string and optional prior chat history, corrects spelling/grammar,
    resolves context references into a standalone query, and classifies the intent into:
    - 'INSTITUTE_RAG': Institute knowledge base query (needs ChromaDB vector search).
    - 'APP_META': Greetings or application questions (direct short LLM response).
    - 'OUT_OF_BOUNDS': General knowledge, code generation, essays (guardrail refusal).

    Returns tuple: (enhanced_query, intent)
    """
    raw = query.strip()
    if not raw:
        return raw, "APP_META"

    formatted_history = _convert_chat_history(chat_history)

    # Audit prompt tokens
    if audit is not None:
        history_text = "\n".join(f"{m.type}: {m.content}" for m in formatted_history)
        prompt_text = f"{QUERY_ENHANCER_SYSTEM_PROMPT}\n{history_text}\n{raw}"
        audit.enhancer_prompt_tokens = count_tokens(prompt_text)

    try:
        res = query_enhancer_chain.invoke({
            "chat_history": formatted_history,
            "query": raw,
            "format_instructions": parser.get_format_instructions()
        })

        if isinstance(res, dict):
            enhanced = str(res.get("enhanced_query") or raw).strip()
            intent = str(res.get("intent") or "INSTITUTE_RAG").upper().strip()
        else:
            enhanced = raw
            intent = "INSTITUTE_RAG"

        if intent not in ("INSTITUTE_RAG", "APP_META", "OUT_OF_BOUNDS"):
            intent = "INSTITUTE_RAG"

        if audit is not None:
            audit.enhancer_completion_tokens = count_tokens(enhanced)

        logger.info(f"[QueryEnhancer] Raw: '{raw}' | Enhanced: '{enhanced}' | Intent: '{intent}'")
        return enhanced, intent
    except Exception as e:
        logger.warning(f"[QueryEnhancer] Enhancement/Routing failed, falling back to INSTITUTE_RAG: {e}")
        if audit is not None:
            audit.enhancer_completion_tokens = 0
        return raw, "INSTITUTE_RAG"


def enhance_query(query: str, chat_history: Optional[List[Any]] = None, audit: Optional[TokenAudit] = None) -> str:
    """Backward compatibility wrapper: returns only the enhanced query string."""
    enhanced, _ = analyze_and_enhance_query(query, chat_history=chat_history, audit=audit)
    return enhanced


