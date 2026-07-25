import os
from langchain_chroma import Chroma
from config.settings import settings

def get_college_vectorstore(college_slug: str) -> Chroma:
    """
    Returns the Chroma vector store for a specific college.
    Each college gets its own isolated collection to prevent cross-contamination of data.
    """
    # Create the persistent directory if it doesn't exist
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    
    collection_name = f"college_{college_slug}"
    
    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=settings.embedding_model,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )
    
    return vectorstore

def add_documents_to_college(college_slug: str, chunks: list):
    """
    Adds a list of Document chunks to the college's vector store.
    Chroma will automatically run the chunks through OllamaEmbeddings.
    """
    if not chunks:
        print("No chunks provided to insert.")
        return
        
    vectorstore = get_college_vectorstore(college_slug)
    vectorstore.add_documents(documents=chunks)
    
    print(f"Successfully generated embeddings and added {len(chunks)} chunks to ChromaDB collection: college_{college_slug}")
