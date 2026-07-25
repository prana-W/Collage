from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders.parsers.pdf import RapidOCRBlobParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config.settings import settings

__all__ = ["process_pdfs"]


def _inject_metadata(documents, extra_metadata):
    for doc in documents:
        doc.metadata.update(extra_metadata)
    return documents


def _load_pdf(pdf_file_names: list[str]):
    """
    Loads PDFs using PyPDFLoader + RapidOCRBlobParser.
    RapidOCRBlobParser performs OCR on image-based pages automatically,
    so both text and scanned image pages are extracted as plain text.
    """
    all_docs = []
    for pdf_name in pdf_file_names:
        file_path = f"../data/{pdf_name}"
        print(f"  Loading: {pdf_name}")
        loader = PyPDFLoader(
            file_path=file_path,
            images_parser=RapidOCRBlobParser()
        )
        docs = loader.load()
        
        for doc in docs:
            doc.metadata["source_file"] = pdf_name
        
        all_docs.extend(docs)
        print(f"  -> {len(docs)} pages extracted from {pdf_name}")
    
    return all_docs


def _chunk_documents(docs):
    """
    Splits all documents into smaller chunks using RecursiveCharacterTextSplitter.
    Since PyPDFLoader outputs plain text (not markdown), we use character splitting directly.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(docs)
    return chunks


def process_pdfs(pdf_file_names: list[str], college_slug: str):
    """
    Main orchestration function:
    1. Load PDFs with RapidOCR for text + image OCR extraction
    2. Chunk the extracted text
    3. Inject college_slug metadata into all chunks
    """
    # 1. Load all PDFs — RapidOCR handles image-based pages automatically
    docs = _load_pdf(pdf_file_names)
    print(f"Total pages loaded: {len(docs)}")

    # 2. Chunk the text content
    chunks = _chunk_documents(docs)

    # 3. Inject the college_slug into all chunks
    final_chunks = _inject_metadata(chunks, {"college_slug": college_slug})

    return final_chunks
