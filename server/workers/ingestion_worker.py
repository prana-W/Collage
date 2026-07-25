"""
Ingestion task function for the RQ worker.

RQ calls this function in a separate worker process.
All imports are done inside the function to ensure they resolve
correctly in the worker process's execution context.
"""

UPLOAD_DIR = "storage/uploads"


def run_ingestion_job(college_slug: str, file_names: list[str]) -> dict:
    """
    The actual ingestion task executed by the RQ worker process.
    
    Args:
        college_slug: The unique identifier for the college/institute.
        file_names:   List of stored filenames to ingest (from storage/uploads/).

    Returns:
        A dict summary of the completed job (stored by RQ as the job result).
    """
    from config.settings import settings
    from ingestion.pdf_ingestion import process_pdfs
    from vectorstore.chroma_client import add_documents_to_college

    upload_dir = settings.UPLOAD_DIR
    chunks = process_pdfs(file_names, college_slug, base_dir=upload_dir)
    add_documents_to_college(college_slug, chunks)

    return {
        "college_slug": college_slug,
        "files_processed": file_names,
        "chunks_ingested": len(chunks),
    }
