import os
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from config.settings import settings
from vectorstore.chroma_client import delete_documents_by_source
from api.v1.auth import get_current_user, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])


@router.get("/view/{filename}", summary="View/stream an uploaded document PDF")
async def view_document(filename: str):
    """
    Serves a PDF document from the storage/uploads directory for inline viewing in browser tabs.
    """
    # Security: Ensure no path traversal
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Requested document was not found.")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{safe_filename}\""}
    )


@router.get("/list/{college_slug}", summary="List all uploaded documents for a college")
async def list_college_documents(
    college_slug: str,
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """
    Returns a list of all PDF documents uploaded for a specific college.
    """
    clean_slug = college_slug.strip().lower()
    prefix = f"{clean_slug}_"

    if not os.path.exists(settings.UPLOAD_DIR):
        return JSONResponse(content={"documents": [], "college_slug": clean_slug})

    documents = []
    for fname in os.listdir(settings.UPLOAD_DIR):
        if fname.lower().startswith(prefix) and fname.lower().endswith(".pdf"):
            full_path = os.path.join(settings.UPLOAD_DIR, fname)
            stat = os.stat(full_path)
            
            # Extract display name (strip prefix and timestamp if present)
            # Format: {slug}_{original_name}_{epoch}.pdf
            display_name = fname[len(prefix):]
            parts = display_name.rsplit("_", 1)
            if len(parts) == 2 and parts[1][:-4].isdigit():
                display_name = parts[0] + ".pdf"

            documents.append({
                "stored_name": fname,
                "display_name": display_name,
                "size_bytes": stat.st_size,
                "formatted_size": f"{stat.st_size / (1024 * 1024):.2f} MB",
                "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    # Sort newest first
    documents.sort(key=lambda d: d["uploaded_at"], reverse=True)

    return JSONResponse(content={"documents": documents, "college_slug": clean_slug})


@router.delete("/{college_slug}/{filename}", summary="Delete a document from filesystem and vector DB")
async def delete_document(
    college_slug: str,
    filename: str,
    current_user: User = Depends(get_current_user)
) -> JSONResponse:
    """
    Deletes a PDF file from storage/uploads and purges its vector embeddings from ChromaDB.
    Requires Admin privileges.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admins can delete documents.")

    clean_slug = college_slug.strip().lower()
    
    # Ensure Admin belongs to the target college
    if current_user.college_slug.strip().lower() != clean_slug:
        raise HTTPException(
            status_code=403,
            detail=f"Admins can only delete documents belonging to their assigned college ('{current_user.college_slug}')."
        )
    safe_filename = os.path.basename(filename)

    # Security check: Ensure file belongs to the requested college slug
    if not safe_filename.lower().startswith(f"{clean_slug}_"):
        raise HTTPException(
            status_code=400,
            detail=f"Document '{safe_filename}' does not belong to college '{clean_slug}'."
        )

    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    # 1. Delete vector embeddings from ChromaDB
    chunks_deleted = delete_documents_by_source(clean_slug, safe_filename)

    # 2. Remove file from filesystem
    file_deleted = False
    if os.path.isfile(file_path):
        os.remove(file_path)
        file_deleted = True
        logger.info(f"Deleted file from filesystem → {file_path}")

    if not file_deleted and chunks_deleted == 0:
        raise HTTPException(status_code=404, detail="Document not found on disk or vector database.")

    return JSONResponse(content={
        "message": f"Successfully deleted '{safe_filename}'.",
        "file_deleted": file_deleted,
        "chunks_purged": chunks_deleted,
    })
