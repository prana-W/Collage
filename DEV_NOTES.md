# Development Notes: Multi-Tenant University RAG Backend

This document tracks the architectural decisions, features built, and system evolution of the project.

## Core Architecture
- **Framework**: FastAPI (Python)
- **Vector Database**: ChromaDB (Local persistent storage)
- **AI Framework**: LangChain (LCEL - LangChain Expression Language)
- **Task Queue**: RQ (Redis Queue) backed by Redis
- **Package Manager**: `uv`

## Implemented Features

### 1. Environment-Aware Model Configuration (`settings.py`)
- Centralized configuration system using Python `@property` decorators.
- **Development Mode**: Uses local **Ollama** models (`qwen3-embedding` for vectors, `llama3.2` for generation) to enable 100% free, local, offline testing.
- **Production Mode**: Swaps to **Google Gemini API** (`embedding-001` for vectors, `gemini-1.5-flash` for generation) for high-speed, scalable deployment.
- Seamlessly swaps underlying LangChain modules (`OllamaEmbeddings` vs `GoogleGenerativeAIEmbeddings`) based on the `.env` file without changing the core business logic.

### 2. Multi-Tenant Vector Storage (`chroma_client.py`)
- Designed to handle multiple universities/institutes securely within a single database.
- Uses ChromaDB **Collections** partitioned by `college_slug` (e.g., `college_nitjsr`, `college_iitb`).
- Prevents cross-contamination of data; when retrieving for `nitjsr`, the vector store physically cannot query `iitb` documents.

### 3. Advanced PDF Ingestion with Local OCR (`pdf_ingestion.py`)
- Uses `PyPDFLoader` wrapped with `RapidOCRBlobParser`.
- **Local OCR**: `RapidOCR` uses a lightweight ONNX model to extract text from image-based/scanned PDFs entirely locally (no heavy GPU required, no slow LLM vision API calls).
- **Chunking**: Uses `RecursiveCharacterTextSplitter` to break documents into overlapping chunks (`size=1000, overlap=200`).
- **Metadata Injection**: Preserves the original `source_file` and `page` number, and injects the `college_slug` into the metadata of every chunk before storing.

### 4. Asynchronous Background Queuing (RQ + Redis)
- **Problem**: PDF ingestion and embedding generation is slow. If done on the main thread, the FastAPI server would block and time out.
- **Solution**: Implemented a background worker system using `rq` (Redis Queue).
- **Flow**:
  1. User calls `POST /api/v1/ingest` with PDFs.
  2. FastAPI saves the files to `storage/uploads/` with a standardized name (`{slug}_{name}_{epoch}.pdf`).
  3. FastAPI enqueues the job in Redis and returns HTTP 202 with a `job_id`.
  4. A separate terminal running `rq worker` pulls the job, runs the heavy LangChain ingestion pipeline, and updates the status to `completed` or `failed`.
  5. User can poll `GET /api/v1/ingest/status/{job_id}` to check progress.

### 5. Memory-less RAG Generation Pipeline (`rag_chain.py`)
- Built a stateless retrieval chain using LangChain's LCEL (LangChain Expression Language).
- **Retrieval**: Uses MMR (Maximal Marginal Relevance) or Similarity search to pull the top 4 chunks from the specific college's ChromaDB collection.
- **Context Formatting**: Automatically formats the retrieved chunks with 1-indexed page numbers (fixing PyPDFLoader's native 0-index) and filenames.
  *(e.g., `[1] Source: notes.pdf | Page: 5`)*.
- **Prompt Engineering**: The System Prompt (`rag_prompt.py`) enforces strict rules:
  - Identity injected dynamically (e.g., *"You are an assistant for nitjsr"*).
  - Must answer **only** from context.
  - Must admit ignorance if context is missing.
  - Must **cite sources** at the bottom of the answer using the formatted chunk prefixes.

### 6. Streaming Output
- Both the local CLI (`main.py`) and underlying chain functions (`chain.stream()`) support token-by-token streaming.
- Crucial for local LLMs (Ollama) which have high latency, ensuring the user sees the answer being generated in real-time instead of waiting for a single large block of text.

---

## Future Roadmap / Pending Items
- Connect the frontend to the `/api/v1/ingest` endpoint.
- Implement the FastAPI endpoint for the RAG generation loop (`POST /api/v1/chat`).
- Add conversational memory (Session ID + LangChain `RunnableWithMessageHistory`) to support multi-turn dialogues.
- Add PM2 / Docker configuration for deploying the FastAPI server, RQ Worker, and Redis container together.
