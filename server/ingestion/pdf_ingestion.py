from langchain_core.documents.base import Document
from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config.settings import settings
import os

__all__ = ["process_pdfs"]

def _inject_metadata(documents, extra_metadata):
    for doc in documents:
        doc.metadata.update(extra_metadata)
    return documents

def _load_pdf(pdf_file_names: list[str]):
    # Create a list of full paths for the loader
    file_paths = [f"../data/{pdf}" for pdf in pdf_file_names]
    
    # Ensure the persistent image storage directory exists
    os.makedirs(settings.IMAGE_OUTPUT_DIR, exist_ok=True)
    
    loader = OpenDataLoaderPDFLoader(
        file_path=file_paths,
        format="markdown",
        split_pages= True,
        image_output= "external",
        image_format="jpeg",
        image_dir=os.path.abspath(settings.IMAGE_OUTPUT_DIR),
        quiet=True,
        
    )
    documents = loader.load()
    return documents

def _chunk_documents(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
   
    chunks = splitter.split_documents(docs)
    return chunks

def process_pdfs(pdf_file_names: list[str], college_slug: str):
    """
    Main orchestration function to process multiple PDFs natively.
    """
    # 1. Load all PDFs at once using the loader's native support
    docs = _load_pdf(pdf_file_names)
    
    # 2. Break all documents into chunks
    chunks = _chunk_documents(docs)
    
    # 3. Inject the common college_slug metadata into all chunks.
    final_chunks = _inject_metadata(chunks, {"college_slug": college_slug})
        
    return final_chunks
