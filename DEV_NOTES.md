# Development Notes: Multi-Tenant University RAG System (COLLAGE)

This document tracks the architectural decisions, features built, and system evolution of the project.

## Core Architecture
- **App Name**: COLLAGE (Wordplay on "College" — unifying scattered campus knowledge into one RAG picture).
- **Backend Framework**: FastAPI (Python)
- **Database**: MySQL (SQLAlchemy + PyMySQL ORM)
- **Vector Database**: ChromaDB (Local persistent storage partitioned by `college_slug`)
- **AI Framework**: LangChain (LCEL - LangChain Expression Language)
- **Task Queue**: RQ (Redis Queue) backed by Redis server
- **Frontend**: React (Vite + TailwindCSS + Lucide Icons + React Router + AuthContext)
- **Package Manager**: `uv` (Python) / `npm` (Node.js)

---

## Implemented Features

### 1. Environment-Aware Model Configuration (`settings.py`)
- Centralized configuration system using Python `@property` decorators.
- **Development Mode**: Uses local **Ollama** models (`qwen3-embedding` for vectors, `llama3.2` for generation) to enable 100% free, local, offline testing.
- **Production Mode**: Swaps to **Google Gemini API** (`embedding-001` for vectors, `gemini-1.5-flash` for generation) for high-speed, scalable deployment.
- Swaps underlying LangChain modules (`OllamaEmbeddings` vs `GoogleGenerativeAIEmbeddings`) based on `.env` without modifying core business logic.

### 2. Multi-Tenant Database & Authentication Layer (`db/` & `api/v1/auth.py`)
- **MySQL Database**: `User` and `College` tables managed via SQLAlchemy ORM and PyMySQL.
- **Automatic Slugification**: Auto-converts institute names into URL-safe slugs (e.g., `"NIT Jamshedpur"` $\rightarrow$ `"nit-jamshedpur"`).
- **Password Security**: `bcrypt` salted password hashing.
- **Session Tokens**: 7-day persistent JWT access token issuance.
- **Dependency Guard**: `get_current_user` FastAPI dependency for Bearer token validation across API endpoints.

### 3. Multi-Tenant Vector Storage (`chroma_client.py`)
- Designed to handle multiple universities/institutes securely within a single ChromaDB instance.
- Partitioned by `college_slug` (e.g., `college_nitjsr`, `college_iitb`).
- Prevents cross-contamination of data; when querying for `nitjsr`, the vector store physically cannot access `iitb` documents.

### 4. Advanced PDF Ingestion with Local OCR & RQ Async Queue (`pdf_ingestion.py`)
- Uses `PyPDFLoader` wrapped with `RapidOCRBlobParser` for ONNX-based local OCR.
- **Chunking**: `RecursiveCharacterTextSplitter` breaking documents into overlapping chunks (`size=1000, overlap=200`).
- **Metadata Injection**: Injects `source_file`, `page` number, and `college_slug`.
- **Async Queue**: Enqueues files via Redis Queue (RQ worker) returning job status (`queued`, `processing`, `completed`, `failed`). Polled every 5 seconds on the frontend dashboard.

### 5. LLM Query Enhancer & Rewriter (`query_enhancer.py`)
- Standalone LangChain LCEL pipeline (`ENHANCER_PROMPT | llm_model | StrOutputParser()`).
- Automatically fixes spelling mistakes, corrects grammar, and expands broken fragments into full, clear questions:
  - *Example*: `"supplentry exem datesss"` $\rightarrow$ `"What is the supplementary exam dates?"`
  - *Example*: `"exam date"` $\rightarrow$ `"What is the exam date?"`
- Runs seamlessly prior to vector search in `build_rag_chain()`.

### 6. Strict Guardrails & Memory-less RAG Chain (`rag_chain.py` & `rag_prompt.py`)
- Built using LangChain Expression Language (LCEL).
- **Strict Context Boundary**: System prompt explicitly forbids the LLM from using its internal pre-trained memory or general training data about the institute or any topic.
- **Zero-Vector Fallback**: If vector search returns 0 relevant chunks, context is set to `NO_RELEVANT_DOCUMENTS_FOUND` and the assistant answers strictly: *"I could not find relevant information in the uploaded institute documents to answer your query."*
- **Citations**: Returns 1-indexed source document and page number citations at the end of answers.
- **Real-Time Streaming**: Token-by-token streaming via `StreamingResponse` for smooth real-time answers.

### 7. React Frontend with AuthContext & Role-Based Access Control
- **`AuthContext.jsx`**: Global React Context managing user sessions, roles (`admin` vs `user`), and JWT persistence in `localStorage`.
- **`ProtectedRoute.jsx`**: Route guard component restricting access:
  - **`Admin` Role**: Exclusive access to PDF Ingestion (`/ingest`).
  - **`User` / `Admin` Role**: Access to Query Assistant (`/query`) with automatic pre-filling of `college_slug`.
- **Restructured Navigation**:
  - `/` — COLLAGE Landing Page introducing the platform philosophy & workflow.
  - `/ingest` — PDF Drag-and-Drop Ingestion & RQ Job Polling Tracker (Admin Only).
  - `/query` — Real-time RAG Query Assistant (Authenticated Users & Admins).
  - `/login` & `/register` — Account authentication & role creation.
- **CSS Token System (`index.css`)**: Built entirely with Tailwind CSS theme tokens (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`, `border-border`, etc.) so changing CSS variables instantly re-themes the entire application.

---

## Startup Instructions

### 1. Redis Server
```bash
redis-server
```

### 2. RQ Background Worker
```bash
cd server
uv run rq worker
```

### 3. FastAPI Backend Server
```bash
cd server
uv run uvicorn app:app --reload
```

### 4. React Frontend
```bash
cd web
npm run dev
```

---

## Future Roadmap / Pending Items
- Add multi-turn conversational memory using `RedisChatMessageHistory` and `RunnableWithMessageHistory`.
- Containerize FastAPI, Redis, MySQL, and RQ Worker with `docker-compose`.
