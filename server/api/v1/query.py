import logging
import json
import uuid
import asyncio
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from llm.rag_chain import query_rag_structured, stream_rag_with_token_audit, RAGResponse
from api.v1.auth import get_current_user
from db.models import User
from db.database import SessionLocal
from db.crud import (
    create_chat_session,
    get_chat_session,
    get_chat_messages,
    add_chat_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/query", tags=["Query"])


class ChatMessageSchema(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text content")


class QueryRequest(BaseModel):
    college_slug: str = Field(..., description="Unique slug for the target college/institute", example="nitjsr")
    question: str = Field(..., description="User query / question", example="What are the passing criteria for DBMS?")
    top_k: int = Field(default=4, description="Number of vector chunks to retrieve", ge=1, le=10)
    chat_id: Optional[str] = Field(None, description="Unique chat session ID. If not provided, a new session is created.")


MOCK_RESPONSE = """### How to Reach NIT Jamshedpur

The best way to reach NIT Jamshedpur is by **bus**. Here's the detailed recommendation:

1. **From Jamshedpur Main Bus Stand (Sakchi):**
   - Take a bus to **Adityapur** (approximately 10 km from Jamshedpur bus stand).
   - Reserve an auto (vehicle) to the campus for convenience, as the fare is **Rs. 150**.
   - The Institute Administrative Building is **3.5 km** from Adityapur-1 (via NIT MORE route).

2. **From Ranchi:**
   - Take a bus to **Jamshedpur** via NH-33 (distance: ~140 km).
   - Road transport is faster and more direct than the train journey of **167 km (4–5 hours)**.

### Alternative Routes

- From **Bistupur**, take an auto to **Adityapur** and follow the NIT MORE route (2 km from All India Radio Building).
- From **Tatanagar Railway Station**, travel to **Bistupur** and then take an auto to the campus.

### Recommendation

For convenience and cost-effectiveness, **reserve an auto from the Jamshedpur Main Bus Stand (Sakchi)** to the campus. This ensures a direct and comfortable journey."""

MOCK_SOURCES = [
    "https://www.nitjsr.ac.in",
    "nitjsr_prospectus_2024.pdf"
]


async def _mock_stream(session_id: str):
    """Streams the mock response word-by-word and persists to DB."""
    words = MOCK_RESPONSE.split(' ')
    full_text = ""
    for i, word in enumerate(words):
        suffix = ' ' if i < len(words) - 1 else ''
        chunk_str = word + suffix
        full_text += chunk_str
        yield chunk_str.encode()
        await asyncio.sleep(0.02)

    audit_payload = {
        "total_tokens": 342,
        "user_cumulative_total": 342,
        "sources": MOCK_SOURCES,
        "chat_id": session_id
    }
    yield f"\n\n__TOKEN_USAGE__:{json.dumps(audit_payload)}".encode()

    # Save mock assistant answer to DB
    db_persist = SessionLocal()
    try:
        add_chat_message(
            db=db_persist,
            session_id=session_id,
            role="assistant",
            content=full_text,
            sources=MOCK_SOURCES,
            token_stats=audit_payload
        )
    except Exception as err:
        logger.error(f"Failed to persist mock assistant answer: {err}")
    finally:
        db_persist.close()


@router.post("", summary="Ask a question against a college's knowledge base")
def query_knowledge_base(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """Accepts a question and college_slug, runs the RAG chain, and returns structured response."""
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    db = SessionLocal()
    try:
        session_id = request.chat_id.strip() if request.chat_id and request.chat_id.strip() else str(uuid.uuid4())
        session = get_chat_session(db, session_id, current_user.id)
        if not session:
            session = create_chat_session(
                db=db,
                user_id=current_user.id,
                college_slug=request.college_slug.strip(),
                session_id=session_id
            )

        db_history_msgs = get_chat_messages(db, session_id)
        chat_history = [{"role": m.role, "content": m.content} for m in db_history_msgs]

        add_chat_message(db, session_id=session_id, role="user", content=request.question.strip())

        rag_response: RAGResponse = query_rag_structured(
            question=request.question.strip(),
            college_slug=request.college_slug.strip(),
            top_k=request.top_k,
            chat_history=chat_history
        )

        add_chat_message(
            db,
            session_id=session_id,
            role="assistant",
            content=rag_response.content,
            sources=rag_response.sources
        )

        return JSONResponse(content={
            "chat_id": session_id,
            "college_slug": request.college_slug,
            "question": request.question,
            "content": rag_response.content,
            "sources": rag_response.sources,
            "asked_by": current_user.email,
        })
    except Exception as e:
        logger.error(f"Error executing RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")
    finally:
        db.close()


@router.post("/stream", summary="Ask a question with token streaming and DB chat history")
def stream_query_knowledge_base(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Streams tokens in real-time. Extracts chat session from DB, populates chat_history
    for query enhancer, and persists both user & assistant messages in MySQL.
    """
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    db = SessionLocal()
    try:
        session_id = request.chat_id.strip() if request.chat_id and request.chat_id.strip() else str(uuid.uuid4())
        session = get_chat_session(db, session_id, current_user.id)
        if not session:
            session = create_chat_session(
                db=db,
                user_id=current_user.id,
                college_slug=request.college_slug.strip(),
                session_id=session_id
            )

        # Retrieve prior history from DB
        db_history_msgs = get_chat_messages(db, session_id)
        chat_history = [{"role": m.role, "content": m.content} for m in db_history_msgs]

        # Store incoming user query into DB
        add_chat_message(db, session_id=session_id, role="user", content=request.question.strip())
    finally:
        db.close()

    # --- DEV MOCK: bypass LLM for fast UI testing ---
    if request.question.strip().lower() == "pranaw-is-testing":
        logger.info("[DEV MOCK] Returning mock stream response.")
        return StreamingResponse(_mock_stream(session_id), media_type="text/plain")

    def chat_stream_wrapper():
        raw_generator = stream_rag_with_token_audit(
            question=request.question.strip(),
            college_slug=request.college_slug.strip(),
            top_k=request.top_k,
            user_id=current_user.id,
            chat_history=chat_history
        )

        full_response = ""
        sources = []
        token_stats = None

        for chunk in raw_generator:
            if isinstance(chunk, str) and "__TOKEN_USAGE__:" in chunk:
                parts = chunk.split("__TOKEN_USAGE__:")
                full_response += parts[0]
                if parts[0]:
                    yield parts[0].encode("utf-8")

                try:
                    stats = json.loads(parts[1].strip())
                    token_stats = stats
                    sources = stats.get("sources", [])
                    stats["chat_id"] = session_id
                    updated_meta = f"\n\n__TOKEN_USAGE__:{json.dumps(stats)}"
                    yield updated_meta.encode("utf-8")
                except Exception:
                    yield chunk.encode("utf-8")
            else:
                text_str = chunk if isinstance(chunk, str) else chunk.decode("utf-8", errors="ignore")
                full_response += text_str
                yield chunk if isinstance(chunk, bytes) else text_str.encode("utf-8")

        # Save assistant message to DB after stream ends
        db_persist = SessionLocal()
        try:
            add_chat_message(
                db=db_persist,
                session_id=session_id,
                role="assistant",
                content=full_response,
                sources=sources,
                token_stats=token_stats
            )
        except Exception as err:
            logger.error(f"Failed to persist assistant response to DB: {err}", exc_info=True)
        finally:
            db_persist.close()

    try:
        return StreamingResponse(chat_stream_wrapper(), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error executing streaming RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to stream answer: {str(e)}")
