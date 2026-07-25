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
        max_tokens=settings.CHUNK_SIZE,
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

        # Inject source filename for retrieval attribution
        for chunk in chunks:
            chunk.metadata["source_file"] = pdf_name

        all_chunks.extend(chunks)

    logger.info(f"[DoclingLoader] Total chunks across all PDFs: {len(all_chunks)}")

    # Inject college_slug for collection-level filtering
    _inject_metadata(all_chunks, {"college_slug": college_slug})

    return all_chunks
