from ingestion.pdf_ingestion import process_pdfs
from vectorstore.chroma_client import add_documents_to_college
from llm.rag_chain import ask

if __name__ == "__main__":
    college_slug = "nit-jamshedpur"

    # --- INGESTION ---
    # Uncomment to re-ingest PDFs into the vector store
    # pdf_files = ["test2.pdf"]
    # print("Starting ingestion...")
    # chunks = process_pdfs(pdf_files, college_slug)
    # print(f"Total chunks: {len(chunks)}")
    # add_documents_to_college(college_slug, chunks)
    # print("Ingestion complete!\n")

    # --- RAG QUERY LOOP ---
    # print(f"Institute Assistant ({college_slug}) — Type 'exit' to quit.\n")
    # while True:
    #     try:
    #         question = input("You: ").strip()
    #         if not question or question.lower() == "exit":
    #             break

    #         ask(question, college_slug, top_k=4)

    #     except KeyboardInterrupt:
    #         break

    # print("\nGoodbye!")

    


