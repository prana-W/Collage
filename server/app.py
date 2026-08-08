import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1.ingest import router as ingest_router
from api.v1.query import router as query_router
from api.v1.auth import router as auth_router
from api.v1.documents import router as documents_router
from api.v1.chats import router as chats_router
from db.database import init_db
from workers.ingestion_queue import get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Verifies Redis connection and initializes database tables on startup.
    """
    try:
        get_redis().ping()
        logger.info("Redis connection verified ✓")
    except Exception as e:
        logger.error(f"Could not connect to Redis: {e}. Make sure Redis is running.")

    # Initialize MySQL tables
    init_db()

    yield
    logger.info("FastAPI server shutting down.")


app = FastAPI(
    title="University RAG API",
    description="Multi-tenant Retrieval-Augmented Generation API for university knowledge bases.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(query_router)
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chats_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Returns server health status."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
