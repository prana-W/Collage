from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
from config.settings import settings
from llm.image_describer import describe_images_in_docs
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
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    
    char_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
    
    all_chunks = []
    for doc in docs:
        # Markdown splitter works on string text
        md_docs = markdown_splitter.split_text(doc.page_content)
        
        # Re-inject the original document metadata (like source_file, page) 
        for md_doc in md_docs:
            md_doc.metadata.update(doc.metadata)
            
        # If any markdown section is STILL larger than CHUNK_SIZE, split it by characters
        final_docs = char_splitter.split_documents(md_docs)
        all_chunks.extend(final_docs)
        
    return all_chunks

def process_pdfs(pdf_file_names: list[str], college_slug: str):
    """
    Main orchestration function to process multiple PDFs natively.
    """
    # 1. Load all PDFs at once using the loader's native support
    docs = _load_pdf(pdf_file_names)
    
    # 2. Describe all images found in the documents and inject descriptions inline
    print(f"Describing images in {len(docs)} pages...")
    docs = describe_images_in_docs(docs)
    
    # 3. Break all documents into chunks
    chunks = _chunk_documents(docs)
    
    # 4. Inject the common college_slug metadata into all chunks.
    final_chunks = _inject_metadata(chunks, {"college_slug": college_slug})
        
    return final_chunks
