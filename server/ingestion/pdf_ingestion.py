import os
import logging

# Suppress HuggingFace tokenizer parallelism warning emitted by Docling internals
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from langchain_docling import DoclingLoader
from langchain_docling.loader import ExportType
from docling.chunking import HybridChunker
from config.settings import settings

logger = logging.getLogger(__name__)

__all__ = ["process_pdfs"]

# BAAI/bge-small-en-v1.5:
#   - 90MB tokenizer, 512-token context window
#   - Designed for retrieval/RAG tasks
#   - Used ONLY to count tokens for chunk boundary decisions —
#     the actual vector store embeddings still use Ollama.
CHUNKER_TOKENIZER = "BAAI/bge-small-en-v1.5"


def _flatten_docling_metadata(chunk) -> None:
    """
    ChromaDB only accepts flat scalar metadata (str, int, float, bool, None).
    Docling adds a nested 'dl_meta' dict that ChromaDB rejects.

    This function:
    1. Extracts useful scalar fields (page_no, headings, origin filename)
    2. Drops the full nested dl_meta dict
    """
    dl_meta = chunk.metadata.pop("dl_meta", {}) or {}

    # Extract page number from first doc_item's first provenance entry
    page_no = None
    try:
        doc_items = dl_meta.get("doc_items", [])
        if doc_items:
            prov = doc_items[0].get("prov", [])
            if prov:
                page_no = prov[0].get("page_no")
    except Exception:
        pass

    # Extract section headings as a flat comma-joined string
    headings = dl_meta.get("headings", [])
    headings_str = " > ".join(headings) if headings else ""

    # Extract origin filename (the original PDF name before our renaming)
    origin_filename = ""
    try:
        origin_filename = dl_meta.get("origin", {}).get("filename", "")
    except Exception:
        pass

    # Write back only scalar-safe fields
    if page_no is not None:
        chunk.metadata["page_no"] = page_no
    if headings_str:
        chunk.metadata["headings"] = headings_str
    if origin_filename:
        chunk.metadata["origin_filename"] = origin_filename


def _inject_metadata(documents, extra_metadata: dict) -> list:
    for doc in documents:
        doc.metadata.update(extra_metadata)
    return documents


def process_pdfs(pdf_file_names: list[str], college_slug: str, base_dir: str = None) -> list:
    """
    Loads PDFs using Docling (DoclingLoader + HybridChunker).

    Docling handles:
      - Layout-aware text extraction (headings, tables, figures, reading order)
      - Semantic chunking via HybridChunker using BAAI/bge-small-en-v1.5 tokenizer
        so chunks respect the 512-token context window of retrieval models

    No separate text splitter is needed — HybridChunker produces chunks
    that are already semantically coherent and token-bounded.

    Args:
        pdf_file_names: List of PDF filenames (not full paths).
        college_slug:   Unique identifier for the college/institute.
        base_dir:       Directory where PDF files are stored.
                        Defaults to settings.UPLOAD_DIR.
    """
    if base_dir is None:
        base_dir = settings.UPLOAD_DIR

    chunker = HybridChunker(
        tokenizer=CHUNKER_TOKENIZER,
        max_tokens=settings.CHUNK_SIZE
    )

    all_chunks = []
    for pdf_name in pdf_file_names:
        file_path = os.path.join(base_dir, pdf_name)
        logger.info(f"[DoclingLoader] Loading: {file_path}")

        loader = DoclingLoader(
            file_path=file_path,
            export_type=ExportType.DOC_CHUNKS,
            chunker=chunker,
        )

        chunks = loader.load()
        logger.info(f"[DoclingLoader] -> {len(chunks)} chunks extracted from '{pdf_name}'")

        for chunk in chunks:
            chunk.metadata["source_file"] = pdf_name
            # Flatten nested Docling metadata so ChromaDB can accept it
            _flatten_docling_metadata(chunk)

        all_chunks.extend(chunks)

    logger.info(f"[DoclingLoader] Total chunks across all PDFs: {len(all_chunks)}")

    _inject_metadata(all_chunks, {"college_slug": college_slug})

    return all_chunks

