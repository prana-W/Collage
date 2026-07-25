from ingestion.pdf_ingestion import process_pdfs
from vectorstore.chroma_client import add_documents_to_college
from retrieval.retriever import search_college_knowledge_base

if __name__ == "__main__":
    college_slug = "nitjsr"

    # --- INGESTION ---
    pdf_files = ["test2.pdf"]
    print("Starting ingestion...")
    chunks = process_pdfs(pdf_files, college_slug)
    print(f"Total chunks: {len(chunks)}")
    add_documents_to_college(college_slug, chunks)
    print("Ingestion complete!\n")

    # --- RETRIEVAL LOOP ---
    print("Enter your queries below. Type 'exit' to quit.\n")
    while True:
        try:
            query = input("Query: ").strip()
            if not query or query.lower() == "exit":
                break

            results = search_college_knowledge_base(query, college_slug, top_k=3)
            print(f"\n{len(results)} results found:\n")
            for i, doc in enumerate(results, 1):
                print(f"[{i}] Page {doc.metadata.get('page', '?')} — {doc.metadata.get('source_file', 'Unknown')}")
                print(doc.page_content.strip())
                print("-" * 60)
        except KeyboardInterrupt:
            break

    print("\nDone.")
