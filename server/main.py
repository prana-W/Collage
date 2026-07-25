from ingestion.pdf_ingestion import process_pdfs
from vectorstore.chroma_client import add_documents_to_college
from retrieval.retriever import search_college_knowledge_base, get_all_documents

if __name__ == "__main__":
    college_slug = "nitjsr"

    # data = get_all_documents("nitjsr")
    # print(data)
    
    # --- INGESTION ---
    print("Testing PDF Ingestion Pipeline...")
    # Passing test2.pdf as requested
    chunks = process_pdfs(["test2.pdf"], college_slug)
    print(f"Total chunks created: {len(chunks)}")
    print("Generating embeddings and saving to ChromaDB...")
    add_documents_to_college(college_slug, chunks)
    print("Ingestion complete!\n")
    
    # # --- RETRIEVAL LOOP ---
    # print("--- Testing Interactive Retrieval Pipeline ---")
    # print("Type 'quit' or 'exit' to stop.")
    
    # while True:
    #     try:
    #         query = input("\nEnter your query: ").strip()
    #         if query.lower() in ['quit', 'exit']:
    #             break
                
    #         if not query:
    #             continue
                
    #         results = search_college_knowledge_base(query, college_slug, top_k=3)
            
    #         print(f"\nFound {len(results)} relevant chunks:")
    #         for i, doc in enumerate(results):
    #             print(f"\n Source: {doc.metadata.get('source_file', 'Unknown')} (Page {doc.metadata.get('page', '?')})")
    #             print("-" * 40)
    #             print(doc.page_content)
    #             print("-" * 40)
    #     except KeyboardInterrupt:
    #         break
            
    # print("\nGoodbye!")
