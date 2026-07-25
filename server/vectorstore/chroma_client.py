import os
import logging
from langchain_chroma import Chroma
from config.settings import settings

logger = logging.getLogger(__name__)


def get_college_vectorstore(college_slug: str) -> Chroma:
    """
    Returns the Chroma vector store for a specific college.
    Each college gets its own isolated collection to prevent cross-contamination of data.
    """
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    collection_name = f"college_{college_slug}"
    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=settings.embedding_model,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )
    return vectorstore


def delete_documents_by_source(college_slug: str, source_file: str) -> int:
    """
    Deletes all chunks in the college's ChromaDB collection that were
    ingested from a specific source file. Used to prevent duplicates on re-upload.

    Returns the number of chunks deleted.
    """
    vectorstore = get_college_vectorstore(college_slug)
    collection = vectorstore._collection

    # Query for all IDs whose metadata 'source_file' matches
    results = collection.get(where={"source_file": source_file})
    ids_to_delete = results.get("ids", [])

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        logger.info(
            f"[ChromaDB] Deleted {len(ids_to_delete)} old chunks for "
            f"source_file='{source_file}' in collection 'college_{college_slug}'"
        )

    return len(ids_to_delete)


def delete_documents_by_root_url(college_slug: str, root_url: str) -> int:
    """
    Deletes all chunks in the college's ChromaDB collection that match
    root_url in metadata (or source_file).
    Used when an admin deletes an ingested website link.
    """
    vectorstore = get_college_vectorstore(college_slug)
    collection = vectorstore._collection

    ids_to_delete = set()

    # Match by metadata 'root_url'
    res1 = collection.get(where={"root_url": root_url})
    if res1 and res1.get("ids"):
        ids_to_delete.update(res1["ids"])

    # Match by metadata 'source_file'
    res2 = collection.get(where={"source_file": root_url})
    if res2 and res2.get("ids"):
        ids_to_delete.update(res2["ids"])

    final_ids = list(ids_to_delete)
    if final_ids:
        collection.delete(ids=final_ids)
        logger.info(
            f"[ChromaDB] Deleted {len(final_ids)} web chunks for "
            f"root_url='{root_url}' in collection 'college_{college_slug}'"
        )

    return len(final_ids)



def add_documents_to_college(college_slug: str, chunks: list):
    """
    Adds a list of Document chunks to the college's vector store.
    Before inserting, deletes any existing chunks from the same source files
    to prevent duplicate accumulation on re-upload.
    """
    if not chunks:
        logger.warning("No chunks provided to insert.")
        return

    # Collect unique source files in this batch
    source_files = {chunk.metadata.get("source_file") for chunk in chunks if chunk.metadata.get("source_file")}

    # Delete old chunks from these source files before re-inserting
    total_deleted = 0
    for sf in source_files:
        total_deleted += delete_documents_by_source(college_slug, sf)

    if total_deleted:
        logger.info(f"[ChromaDB] Cleared {total_deleted} stale chunks before re-ingestion.")

    vectorstore = get_college_vectorstore(college_slug)
    vectorstore.add_documents(documents=chunks)

    logger.info(
        f"[ChromaDB] Successfully added {len(chunks)} chunks to "
        f"collection 'college_{college_slug}'"
    )
    print(f"Successfully added {len(chunks)} chunks to ChromaDB collection: college_{college_slug}")
