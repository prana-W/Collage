import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from llm.rag_chain import build_rag_chain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/query", tags=["Query"])


class QueryRequest(BaseModel):
    college_slug: str = Field(..., description="Unique slug for the target college/institute", example="nitjsr")
    question: str = Field(..., description="User query / question", example="What are the passing criteria for DBMS?")
    top_k: int = Field(default=4, description="Number of vector chunks to retrieve", ge=1, le=10)


@router.post("", summary="Ask a question against a college's knowledge base")
async def query_knowledge_base(request: QueryRequest) -> JSONResponse:
    """
    Accepts a question and college_slug, runs the RAG chain, and returns
    the generated answer with source citations.
    """
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    try:
        chain = build_rag_chain(college_slug=request.college_slug.strip(), top_k=request.top_k)
        answer = chain.invoke({"question": request.question.strip()})

        return JSONResponse(content={
            "college_slug": request.college_slug,
            "question": request.question,
            "answer": answer,
        })
    except Exception as e:
        logger.error(f"Error executing RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")


@router.post("/stream", summary="Ask a question with token streaming")
async def stream_query_knowledge_base(request: QueryRequest):
    """
    Streams tokens in real-time using Server-Sent Events (SSE) / text stream.
    """
    if not request.college_slug.strip():
        raise HTTPException(status_code=400, detail="college_slug cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    try:
        chain = build_rag_chain(college_slug=request.college_slug.strip(), top_k=request.top_k)

        def event_generator():
            for chunk in chain.stream({"question": request.question.strip()}):
                yield chunk

        return StreamingResponse(event_generator(), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error executing streaming RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to stream answer: {str(e)}")
