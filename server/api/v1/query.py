import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from llm.rag_chain import query_rag_structured, stream_rag_with_token_audit, RAGResponse
from api.v1.auth import get_current_user
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/query", tags=["Query"])


class QueryRequest(BaseModel):
    college_slug: str = Field(..., description="Unique slug for the target college/institute", example="nitjsr")
    question: str = Field(..., description="User query / question", example="What are the passing criteria for DBMS?")
    top_k: int = Field(default=4, description="Number of vector chunks to retrieve", ge=1, le=10)


@router.post("", summary="Ask a question against a college's knowledge base")
async def query_knowledge_base(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """
    Accepts a question and college_slug, runs the RAG chain, and returns
    a structured response (content and sources) via Pydantic model. Requires Bearer Token.
    """
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    try:
        rag_response: RAGResponse = query_rag_structured(
            question=request.question.strip(),
            college_slug=request.college_slug.strip(),
            top_k=request.top_k
        )

        return JSONResponse(content={
            "college_slug": request.college_slug,
            "question": request.question,
            "content": rag_response.content,
            "sources": rag_response.sources,
            "asked_by": current_user.email,
        })
    except Exception as e:
        logger.error(f"Error executing RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")


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

import json
import asyncio


async def _mock_stream():
    """Streams the mock response word-by-word for realistic testing."""
    words = MOCK_RESPONSE.split(' ')
    for i, word in enumerate(words):
        suffix = ' ' if i < len(words) - 1 else ''
        yield (word + suffix).encode()
        await asyncio.sleep(0.02)

    audit_payload = {
        "total_tokens": 342,
        "user_cumulative_total": 342,
        "sources": MOCK_SOURCES
    }
    yield f"\n\n__TOKEN_USAGE__:{json.dumps(audit_payload)}".encode()


@router.post("/stream", summary="Ask a question with token streaming")
async def stream_query_knowledge_base(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Streams tokens in real-time using Server-Sent Events (SSE) / text stream. Requires Bearer Token.
    Appends token audit metrics and sources list at the end of the stream.
    Use question="pranaw-is-testing" to get a fast mock response without calling the LLM.
    """
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    # --- DEV MOCK: bypass LLM for fast UI testing ---
    if request.question.strip().lower() == "pranaw-is-testing":
        logger.info("[DEV MOCK] Returning mock stream response.")
        return StreamingResponse(_mock_stream(), media_type="text/plain")

    try:
        generator = stream_rag_with_token_audit(
            question=request.question.strip(),
            college_slug=request.college_slug.strip(),
            top_k=request.top_k,
            user_id=current_user.id
        )
        return StreamingResponse(generator, media_type="text/plain")
    except Exception as e:
        logger.error(f"Error executing streaming RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to stream answer: {str(e)}")
