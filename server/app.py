import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1.ingest import router as ingest_router
from workers.ingestion_queue import get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Verifies the Redis connection is reachable on startup.
    The actual RQ worker runs as a separate process — start it with:
        rq worker
    """
    try:
        get_redis().ping()
        logger.info("Redis connection verified ✓")
    except Exception as e:
        logger.error(f"Could not connect to Redis: {e}. Make sure Redis is running.")
    yield
    logger.info("FastAPI server shutting down.")


app = FastAPI(
    title="University RAG API",
    description="Multi-tenant Retrieval-Augmented Generation API for university knowledge bases.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(ingest_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Returns server health status."""
    return {"status": "ok"}
