import os
import time
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from rq.job import Job
from rq.exceptions import NoSuchJobError
from workers.ingestion_queue import get_queue, get_redis
from workers.ingestion_worker import run_ingestion_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])

UPLOAD_DIR = "storage/uploads"

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
    job = q.enqueue(run_ingestion_job, college_slug, saved_files)

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
