# University Multi-Tenant RAG Backend

This is the FastAPI backend for the University RAG system. It handles PDF ingestion (with ONNX-based local OCR), text chunking, vector embedding via ChromaDB, and a fully functional Retrieval-Augmented Generation (RAG) pipeline via Ollama or Google Gemini.

It uses **Redis** and **RQ** (Redis Queue) to process document ingestion in the background without blocking the main API thread.

## Prerequisites

Before starting, ensure you have the following installed on your system:
1. **Python 3.11+**
2. **uv** (Python package manager, `curl -LsSf https://astral.sh/uv/install.sh | sh`)
3. **Redis** (Required for the ingestion queue)
4. **Ollama** (Required for local LLMs and embeddings)

### Installing Redis (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

### Pulling Ollama Models
By default, the development environment uses `qwen3-embedding:0.6b` for embeddings and `llama3.2` for generation. Ensure they are downloaded:
```bash
ollama pull qwen3-embedding:0.6b
ollama pull llama3.2
```

## Setup Instructions

1. **Install dependencies using `uv`:**
   ```bash
   # Make sure you are in the server/ directory
   uv sync
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.sample .env
   ```
   Open `.env` and configure your models. If you are testing locally, the defaults (`ENVIRONMENT=development`) will automatically use Ollama.

## Running the Architecture

You need **three terminal windows** running simultaneously to operate the full stack.

### Terminal 1: Redis (If not running as a background service)
If you didn't start Redis via `systemctl`, run it manually:
```bash
redis-server
```

### Terminal 2: FastAPI Server
Starts the API endpoints (runs on `http://127.0.0.1:8000`).
```bash
cd server
uv run uvicorn app:app --reload
```

### Terminal 3: RQ Worker
Starts the background process that pulls ingestion jobs from Redis and executes them.
```bash
cd server
uv run rq worker
```

## API Usage

### 1. Ingest PDFs (POST)
Queues a background job to OCR, chunk, and embed PDFs into the vector store.
```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -F "college_slug=nitjsr" \
  -F "files=@test2.pdf"
```
*Returns a `job_id`.*

### 2. Check Job Status (GET)
Check the progress of your background ingestion job.
```bash
curl http://localhost:8000/api/v1/ingest/status/<job_id>
```

## Local CLI Testing
If you want to test the RAG generation or manual ingestion without using the FastAPI endpoints, you can use the built-in CLI:
```bash
uv run python3 main.py
```
