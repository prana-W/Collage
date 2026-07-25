import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from config.settings import settings

logger = logging.getLogger(__name__)

QUERY_ENHANCER_SYSTEM_PROMPT = """\
You are an expert NLP query rewriter and enhancer for an academic institute search engine.
Your task is to fix spelling mistakes, correct grammatical errors, and expand broken keyword fragments into a clear, complete, and well-formed question.

RULES:
1. Fix any typos or spelling errors (e.g., "syllbus" -> "syllabus", "admision" -> "admission").
2. Correct grammar and sentence structure.
3. If the user input is a short fragment or keyword phrase, rephrase it into a natural question while preserving its exact intent.
   Examples:
   - "exam date" -> "What is the exam date?"
   - "dbms syllabus nitjsr" -> "What is the DBMS syllabus for NIT Jamshedpur?"
   - "fee structure for cse" -> "What is the fee structure for Computer Science Engineering?"
4. Do NOT change the core meaning or subject of the query.
5. Return ONLY the refined, enhanced query text. Do NOT add any preamble, explanations, quotes, or conversational filler.
"""

ENHANCER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", QUERY_ENHANCER_SYSTEM_PROMPT),
    ("human", "{query}"),
])

from utils.token_counter import count_tokens, TokenAudit

# LangChain LCEL chain for query enhancement
query_enhancer_chain = ENHANCER_PROMPT | settings.llm_model | StrOutputParser()


def enhance_query(query: str, audit: TokenAudit = None) -> str:
    """
    Takes a raw user query string, corrects spelling/grammar, expands broken fragments,
    and returns the clean, enhanced query string using LangChain LCEL.
    Also records token usage in TokenAudit if provided.
    """
    raw = query.strip()
    if not raw:
        return raw

    # Audit prompt tokens
    if audit is not None:
        prompt_text = f"{QUERY_ENHANCER_SYSTEM_PROMPT}\n{raw}"
        audit.enhancer_prompt_tokens = count_tokens(prompt_text)

    try:
        enhanced = query_enhancer_chain.invoke({"query": raw}).strip()
        # Fallback if LLM returns empty string
        if not enhanced:
            enhanced = raw

        if audit is not None:
            audit.enhancer_completion_tokens = count_tokens(enhanced)

        logger.info(f"[QueryEnhancer] Raw query: '{raw}' -> Enhanced query: '{enhanced}'")
        return enhanced
    except Exception as e:
        logger.warning(f"[QueryEnhancer] Query enhancement failed, using raw query: {e}")
        if audit is not None:
            audit.enhancer_completion_tokens = 0
        return raw
