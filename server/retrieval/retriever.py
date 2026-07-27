import logging
from langchain_core.documents.base import Document
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langsmith import traceable
from vectorstore.chroma_client import get_college_vectorstore

logger = logging.getLogger(__name__)


@traceable(name="Hybrid Document Retrieval", run_type="retriever")
def search_college_knowledge_base(query: str, college_slug: str, top_k: int = 4) -> list[Document]:
    """
    Hybrid retrieval using an EnsembleRetriever that combines:
    
    - MMR Retriever (ChromaDB): Dense semantic search via embeddings with Maximal 
      Marginal Relevance for diversity (avoids returning near-duplicate chunks).
    
    - BM25 Retriever: Sparse lexical retrieval that excels at exact keyword 
      matches (e.g., specific course codes, names, or acronyms that embeddings
      might miss in semantic space).
    
    The EnsembleRetriever uses Reciprocal Rank Fusion (RRF) to merge and
    re-rank results from both retrievers into a single deduplicated list.
    
    Weights: BM25=0.6, MMR=0.4 — giving higher priority to sparse keyword precision
    while using dense semantic search for complementary retrieval.
    """
    vectorstore = get_college_vectorstore(college_slug)

    # --- Dense Retriever (MMR via ChromaDB) ---
    mmr_retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": top_k,
            "fetch_k": top_k * 3,   # Fetch 3x candidates for MMR to diversify from
            "lambda_mult": 0.6,     # 0=max diversity, 1=max relevance; 0.6 balances both
        },
    )

    # --- Sparse Retriever (BM25 over all college documents) ---
    all_docs = _get_all_documents(vectorstore)
    if not all_docs:
        # No documents ingested yet — fall back to MMR only
        logger.warning(f"[Retriever] No documents found for '{college_slug}', using MMR only.")
        return mmr_retriever.invoke(query)

    bm25_retriever = BM25Retriever.from_documents(all_docs, k=top_k)

    # --- Ensemble: Reciprocal Rank Fusion ---
    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, mmr_retriever],
        weights=[0.6, 0.4],    # BM25 60% (Higher priority) | MMR 40%
    )

    results = ensemble_retriever.invoke(query)

    logger.info(
        f"[Retriever] Hybrid retrieval for '{college_slug}' | query='{query[:60]}' | "
        f"results={len(results)}"
    )
    return results


def _get_all_documents(vectorstore) -> list[Document]:
    """
    Fetches all raw document chunks from the ChromaDB collection.
    Used internally to build the BM25 index over the college's knowledge base.
    """
    collection_data = vectorstore.get()
    docs = []
    if collection_data and "documents" in collection_data:
        for i in range(len(collection_data["documents"])):
            docs.append(
                Document(
                    page_content=collection_data["documents"][i],
                    metadata=collection_data["metadatas"][i],
                )
            )
    return docs


def get_all_documents(college_slug: str) -> list[Document]:
    """
    Public API: Retrieves all document chunks stored in the vector store for a
    specific college. Useful for debugging or displaying the raw knowledge base.
    """
    vectorstore = get_college_vectorstore(college_slug)
    return _get_all_documents(vectorstore)
