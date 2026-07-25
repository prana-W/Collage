import sys
import os
from vectorstore.chroma_client import get_college_vectorstore


def export_college_documents_to_txt(college_slug: str, output_filepath: str = None) -> str:
    """
    Fetches all document chunks stored in ChromaDB for a specific college slug
    and writes them into a formatted text file.
    """
    clean_slug = college_slug.strip().lower()
    if not output_filepath:
        output_filepath = f"exported_{clean_slug}_documents.txt"

    vectorstore = get_college_vectorstore(clean_slug)
    collection = vectorstore._collection

    # Fetch all stored documents and metadata from ChromaDB
    results = collection.get(include=["documents", "metadatas"])
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []
    ids = results.get("ids") or []

    print(f"🔍 Found {len(documents)} chunks in ChromaDB for collection 'college_{clean_slug}'.")

    with open(output_filepath, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write(f"CHROMADB VECTOR STORE EXPORT FOR COLLEGE: {clean_slug.upper()}\n")
        f.write(f"Total Chunks Stored: {len(documents)}\n")
        f.write("=" * 80 + "\n\n")

        if not documents:
            f.write("No document chunks found in vector store for this college slug.\n")
        else:
            for idx, (doc_id, text, meta) in enumerate(zip(ids, documents, metadatas), start=1):
                f.write(f"--- CHUNK #{idx} [ID: {doc_id}] ---\n")
                if meta:
                    f.write(f"Source Type : {meta.get('source_type', 'N/A')}\n")
                    f.write(f"Source File : {meta.get('source_file', 'N/A')}\n")
                    if meta.get('source_url'):
                        f.write(f"Source URL  : {meta.get('source_url')}\n")
                    if meta.get('title'):
                        f.write(f"Title       : {meta.get('title')}\n")
                    f.write(f"Full Metadata: {meta}\n")
                f.write(f"\n[CONTENT]\n{text}\n")
                f.write("-" * 80 + "\n\n")

    print(f"✅ Export complete! Output saved to: '{os.path.abspath(output_filepath)}'")
    return output_filepath


if __name__ == "__main__":
    # Get college slug from CLI arg or default to 'nitjsr'
    target_slug = sys.argv[1] if len(sys.argv) > 1 else "nitjsr"
    out_file = sys.argv[2] if len(sys.argv) > 2 else f"exported_{target_slug}_documents.txt"

    print(f"Exporting vector store content for college slug '{target_slug}'...")
    export_college_documents_to_txt(target_slug, out_file)
