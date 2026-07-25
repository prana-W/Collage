from langchain_core.documents.base import Document
from vectorstore.chroma_client import get_college_vectorstore

def search_college_knowledge_base(query: str, college_slug: str, top_k: int = 4):
    """
    Takes a user query and a college slug, and retrieves the most relevant
    document chunks from that specific college's vector store.
    """
    vectorstore = get_college_vectorstore(college_slug)
    retriever = vectorstore.as_retriever(search_type = "mmr", search_kwargs={"k": top_k})
    
    results = retriever.invoke(query)
    
    return results

def get_all_documents(college_slug: str):
    """
    Retrieves all document chunks currently stored in the vector store for a specific college.
    Useful for debugging or displaying the raw knowledge base.
    """
    vectorstore = get_college_vectorstore(college_slug)
    
    # Fetch all raw data from the Chroma collection
    collection_data = vectorstore.get()
    
    # Reconstruct them into standard LangChain Document objects
    docs = []
    if collection_data and "documents" in collection_data:
        for i in range(len(collection_data["documents"])):
            doc = Document(
                page_content=collection_data["documents"][i],
                metadata=collection_data["metadatas"][i]
            )
            docs.append(doc)
            
    return docs
