import os
import time
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from rq.job import Job
from rq.exceptions import NoSuchJobError
from workers.ingestion_queue import get_queue, get_redis
from workers.ingestion_worker import run_ingestion_job

from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])

UPLOAD_DIR = settings.UPLOAD_DIR

# Map RQ's internal status strings to friendlier ones
_STATUS_MAP = {
    "queued": "queued",
    "started": "processing",
    "finished": "completed",
    "failed": "failed",
    "stopped": "stopped",
    "canceled": "canceled",
}


@router.post("", summary="Upload PDFs for background ingestion")
async def ingest_pdfs(
    college_slug: str = Form(..., description="The unique identifier (slug) for the college/institute"),
    files: list[UploadFile] = File(..., description="One or more PDF files to ingest"),
) -> JSONResponse:
    """
    Accepts PDF files and a college slug.
    Saves files to local storage, enqueues them in RQ (backed by Redis),
    and immediately returns a job_id the caller can use to track ingestion status.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    epoch = int(time.time())
    saved_files = []

    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' is not a PDF file.")

        # Standardise filename: {college_slug}_{original_name}_{epoch}.pdf
        safe_name = upload.filename.replace(" ", "_").replace("/", "_")
        # Strip any existing .pdf extension before adding ours
        base_name = safe_name[:-4] if safe_name.lower().endswith(".pdf") else safe_name
        stored_name = f"{college_slug}_{base_name}_{epoch}.pdf"
        file_path = os.path.join(UPLOAD_DIR, stored_name)

        content = await upload.read()
        with open(file_path, "wb") as f:
            f.write(content)

        saved_files.append(stored_name)
        logger.info(f"Saved uploaded file → {file_path}")

    # Enqueue the job in RQ — RQ stores the job in Redis automatically
    q = get_queue()
    # Docling runs layout AI models and can take several minutes for large PDFs.
    # timeout=1800 gives up to 30 minutes before RQ kills the job.
    job = q.enqueue(run_ingestion_job, college_slug, saved_files, job_timeout=1800)

    logger.info(f"Job {job.id} enqueued for college '{college_slug}' — {len(saved_files)} file(s)")

    return JSONResponse(status_code=202, content={
        "message": "Files queued for ingestion. Use the job_id to track progress.",
        "job_id": job.id,
        "college_slug": college_slug,
        "files_queued": saved_files,
        "status": "queued",
    })


@router.get("/status/{job_id}", summary="Check ingestion job status")
async def get_job_status(job_id: str) -> JSONResponse:
    """
    Returns the current status and result of an ingestion job.
    Status: queued | processing | completed | failed | stopped | canceled
    """
    try:
        job = Job.fetch(job_id, connection=get_redis())
    except NoSuchJobError:
        raise HTTPException(status_code=404, detail=f"No job found with id '{job_id}'.")

    raw_status = str(job.get_status().value) if hasattr(job.get_status(), "value") else str(job.get_status())
    status = _STATUS_MAP.get(raw_status, raw_status)

    return JSONResponse(content={
        "job_id": job.id,
        "status": status,
        "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
        "result": job.result if status == "completed" else None,
        "error": str(job.latest_result().exc_string) if status == "failed" else None,
    })


# ──────────────────────────────────────────────────────────────
# Web Crawl Ingestion Endpoints
# ──────────────────────────────────────────────────────────────

from pydantic import BaseModel, HttpUrl
from fastapi import Depends, BackgroundTasks
from sqlalchemy.orm import Session
from db.database import get_db
from api.v1.auth import get_current_user, User
from db.crud import create_web_link, update_web_link_status, get_web_links_by_college, get_web_link_by_id, delete_web_link_by_id
from vectorstore.chroma_client import delete_documents_by_root_url
from ingestion.web_ingestion import ingest_website


class WebIngestRequest(BaseModel):
    url: str
    max_pages: int = 10
    college_slug: str | None = None


async def _run_web_ingestion_task(link_id: int, url: str, college_slug: str, max_pages: int):
    """Background task to run website crawling and update MySQL status."""
    from db.database import SessionLocal
    db = SessionLocal()
    try:
        update_web_link_status(db, link_id, status="processing")
        result = await ingest_website(start_url=url, college_slug=college_slug, max_pages=max_pages)
        update_web_link_status(
            db,
            link_id,
            status="completed",
            pages_crawled=result.get("pages_crawled", 0),
            chunks_stored=result.get("chunks_stored", 0)
        )
        logger.info(f"Web ingestion finished for link_id={link_id} | {result}")
    except Exception as e:
        logger.error(f"Web ingestion failed for link_id={link_id}: {e}", exc_info=True)
        update_web_link_status(db, link_id, status="failed", error_message=str(e))
    finally:
        db.close()


@router.post("/web", summary="Ingest a college website link using Crawl4AI")
async def ingest_web_link(
    payload: WebIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """
    Ingests a college website URL using Crawl4AI.
    Renders JavaScript, extracts clean markdown, chunks it, and stores it in ChromaDB.
    Also tracks the link entry in MySQL. Only Admins can trigger web ingestion.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admins can trigger website ingestion.")

    clean_url = payload.url.strip()
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    target_slug = (payload.college_slug or current_user.college_slug or "default").strip().lower()

    if current_user.college_slug and current_user.college_slug.strip().lower() != target_slug:
        raise HTTPException(status_code=403, detail="You can only ingest web links for your assigned college.")

    max_pages = max(1, min(payload.max_pages, 50))

    # 1. Store initial record in MySQL
    web_link = create_web_link(
        db,
        college_slug=target_slug,
        url=clean_url,
        max_pages=max_pages,
        user_id=current_user.id
    )

    # 2. Queue background task for web ingestion
    background_tasks.add_task(_run_web_ingestion_task, web_link.id, clean_url, target_slug, max_pages)

    return JSONResponse(status_code=202, content={
        "message": f"Website crawling initiated for '{clean_url}'.",
        "link_id": web_link.id,
        "college_slug": target_slug,
        "url": clean_url,
        "max_pages": max_pages,
        "status": "processing"
    })


@router.get("/web/links/{college_slug}", summary="List all web links ingested for a college")
async def list_web_links(
    college_slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """Returns all web link entries stored in MySQL for the given college."""
    clean_slug = college_slug.strip().lower()
    links = get_web_links_by_college(db, clean_slug)
    return JSONResponse(content={"links": [link.to_dict() for link in links], "college_slug": clean_slug})


@router.delete("/web/links/{link_id}", summary="Delete a web link and purge its vector embeddings")
async def delete_web_link_endpoint(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """
    Deletes a web link from MySQL and purges all associated vector embeddings from ChromaDB.
    Requires Admin privileges.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admins can delete web links.")

    web_link = get_web_link_by_id(db, link_id)
    if not web_link:
        raise HTTPException(status_code=404, detail=f"Web link with ID {link_id} not found.")

    if current_user.college_slug and current_user.college_slug.strip().lower() != web_link.college_slug.strip().lower():
        raise HTTPException(status_code=403, detail="Admins can only delete web links for their assigned college.")

    target_slug = web_link.college_slug
    root_url = web_link.url

    # 1. Purge all chunks from ChromaDB for this root URL
    chunks_deleted = delete_documents_by_root_url(target_slug, root_url)

    # 2. Delete entry from MySQL
    delete_web_link_by_id(db, link_id)

    logger.info(f"Deleted WebLink id={link_id} url='{root_url}' | Purged {chunks_deleted} chunks from ChromaDB")

    return JSONResponse(content={
        "message": f"Successfully deleted web link '{root_url}'.",
        "link_id": link_id,
        "url": root_url,
        "chunks_purged": chunks_deleted
    })

