import logging
from typing import Any, List, Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from config.settings import settings
from utils.token_counter import count_tokens, TokenAudit

logger = logging.getLogger(__name__)

QUERY_ENHANCER_SYSTEM_PROMPT = """\
You are an expert NLP query rewriter and enhancer for an academic institute search engine.
Your task is to analyze the conversation history up to this point and the user's latest query, and rewrite the latest query into a single, standalone, complete, and well-formed question.

RULES:
1. Contextual Resolution: If the latest query references prior conversation context (using pronouns like 'its', 'he', 'they', 'this', 'that', or implicit references like 'What is its syllabus?'), resolve those references using the conversation history into a clear standalone question (e.g., 'What is the syllabus for Electrical Engineering?').
2. Spelling & Grammar: Fix any typos or spelling errors (e.g., "syllbus" -> "syllabus", "admision" -> "admission").
3. Keyword Expansion: If the user input is a short fragment or keyword phrase, rephrase it into a natural question while preserving its exact intent.
   Examples:
   - "exam date" -> "What is the exam date?"
   - "dbms syllabus nitjsr" -> "What is the DBMS syllabus for NIT Jamshedpur?"
   - "fee structure for cse" -> "What is the fee structure for Computer Science Engineering?"
4. Do NOT answer the question. Do NOT change the core meaning or subject of the query.
5. Return ONLY the single refined, standalone query text. Do NOT add any preamble, explanations, quotes, or conversational filler.
"""

ENHANCER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", QUERY_ENHANCER_SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{query}"),
])

# LangChain LCEL chain for query enhancement
query_enhancer_chain = ENHANCER_PROMPT | settings.llm_model | StrOutputParser()


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


def enhance_query(query: str, chat_history: Optional[List[Any]] = None, audit: Optional[TokenAudit] = None) -> str:
    """
    Takes a raw user query string and optional prior chat history, corrects spelling/grammar,
    resolves context references into a standalone query, and returns the enhanced query string.
    Also records token usage in TokenAudit if provided.
    """
    raw = query.strip()
    if not raw:
        return raw

    formatted_history = _convert_chat_history(chat_history)

    # Audit prompt tokens
    if audit is not None:
        history_text = "\n".join(f"{m.type}: {m.content}" for m in formatted_history)
        prompt_text = f"{QUERY_ENHANCER_SYSTEM_PROMPT}\n{history_text}\n{raw}"
        audit.enhancer_prompt_tokens = count_tokens(prompt_text)

    try:
        enhanced = query_enhancer_chain.invoke({
            "chat_history": formatted_history,
            "query": raw
        }).strip()

        # Fallback if LLM returns empty string
        if not enhanced:
            enhanced = raw

        if audit is not None:
            audit.enhancer_completion_tokens = count_tokens(enhanced)

        logger.info(f"[QueryEnhancer] Raw query: '{raw}' | History msgs: {len(formatted_history)} -> Enhanced query: '{enhanced}'")
        return enhanced
    except Exception as e:
        logger.warning(f"[QueryEnhancer] Query enhancement failed, using raw query: {e}")
        if audit is not None:
            audit.enhancer_completion_tokens = 0
        return raw

