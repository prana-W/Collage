# Developer Reference Guide: COLLAGE (Multi-Tenant University RAG System)

Welcome to the **COLLAGE** developer documentation. This document serves as the complete technical specification, architectural guide, and codebase map for developers onboarding to or maintaining the project.

---

## 1. Executive Summary & Tech Stack

**COLLAGE** (a wordplay on "College") unifies scattered campus knowledge (PDF syllabi, notices, exam schedules, room allotments, and web pages) into a isolated, multi-tenant RAG (Retrieval-Augmented Generation) system.

### Core Stack
- **Backend**: FastAPI (Python 3.13) managed via `uv`
- **Database**: MySQL (SQLAlchemy 2.0 ORM + PyMySQL)
- **Vector Database**: ChromaDB (Local persistent vector store partitioned by `college_slug`)
- **AI / RAG Framework**: LangChain (LCEL - LangChain Expression Language)
- **Document Parsing**: Docling (`DoclingLoader` + `HybridChunker` + `BAAI/bge-small-en-v1.5` tokenizer)
- **Web Crawling**: Crawl4AI (Playwright-based stealth crawling with HTML/Markdown parsing)
- **Task Queue**: RQ (Redis Queue) backed by Redis Server
- **Frontend**: React (Vite + TailwindCSS + Lucide Icons + React Router)
- **Embeddings & LLM**: Dual-mode (Ollama for 100% offline local dev, Google Gemini for cloud production)

---

## 2. Directory Tree & Codebase Map

```text
Collage/
├── DEV_NOTES.md                     # Comprehensive developer & architectural documentation
├── server/                          # FastAPI Backend Root
│   ├── app.py                       # Application entrypoint & middleware configuration
│   ├── pyproject.toml               # Python dependencies & uv project config
│   ├── config/
│   │   └── settings.py              # Environment-aware settings & dual model provider loader
│   ├── db/
│   │   ├── database.py              # SQLAlchemy engine & session maker
│   │   ├── models.py                # MySQL ORM models (User, College, WebLink)
│   │   └── crud.py                  # Database CRUD helpers & token usage recording
│   ├── api/v1/
│   │   ├── auth.py                  # Auth endpoints (/login, /register, /me) & JWT logic
│   │   ├── ingest.py                # PDF & Web ingestion endpoints + RQ job status polling
│   │   ├── query.py                 # Streaming & non-streaming RAG query endpoints (supports chat_history)
│   │   └── documents.py             # File serving & admin document deletion (with Chroma purge)
│   ├── ingestion/
│   │   ├── pdf_ingestion.py         # DoclingLoader + HybridChunker PDF parsing pipeline
│   │   └── web_ingestion.py         # Crawl4AI BFS web scraper + Markdown chunking
│   ├── vectorstore/
│   │   └── chroma_client.py         # Per-college isolated ChromaDB vectorstore manager & purger
│   ├── retrieval/
│   │   └── retriever.py             # Hybrid EnsembleRetriever (BM25 60% + Chroma MMR 40%)
│   ├── llm/
│   │   ├── query_enhancer.py        # Context-aware LLM query rewriter using conversation history
│   │   └── rag_chain.py             # RAG chain, streaming token counter, and source extraction
│   ├── prompts/
│   │   └── rag_prompt.py            # Closed-domain system instructions & constraints
│   ├── utils/
│   │   └── token_counter.py         # Tiktoken token estimation & audit data structure
│   ├── workers/
│   │   ├── ingestion_queue.py       # Redis connection factory & RQ queue helper
│   │   └── ingestion_worker.py      # Background worker task consuming ingestion jobs
│   └── storage/
│       ├── uploads/                 # Persistent storage for raw PDF files
│       └── chroma_db/               # Persistent ChromaDB vector data files
└── web/                             # React Vite Frontend Root
    ├── src/
    │   ├── main.jsx                 # React root & Router provider
    │   ├── App.jsx                  # Main application router layout
    │   ├── context/
    │   │   └── AuthContext.jsx      # Global auth state, user role, & JWT persistence
    │   ├── components/
    │   │   ├── Navbar.jsx           # Global navigation header
    │   │   ├── ProtectedRoute.jsx   # Role-based route guard (Admin vs User)
    │   │   ├── ProfileModal.jsx     # User token usage & profile portal modal
    │   │   └── confirm-dialog.jsx   # Shadcn confirmation dialog for deletions
    │   └── pages/
    │       ├── Home.jsx             # Public landing page
    │       ├── Login.jsx            # Account login page
    │       ├── Register.jsx         # User registration page
    │       ├── Ingest.jsx           # PDF Upload & Web Crawler Admin Dashboard
    │       ├── Documents.jsx        # Admin Document & Crawled Link Management
    │       └── Query.jsx            # Interactive AI RAG Query interface with chat memory & citations
    └── vite.config.js               # Vite build & proxy settings
```

---

## 3. Core Technical Decisions & Rationale

### 1. Multi-Tenant Vector Partitioning (`chroma_client.py`)
- **Decision**: Every college gets an isolated ChromaDB collection named `college_<slug>` (e.g. `college_nit-jamshedpur`).
- **Rationale**: Guarantees zero data leak between institutes. Vector queries explicitly target only the requested college's collection.

### 2. Layout-Aware PDF Ingestion (`pdf_ingestion.py`)
- **Decision**: Migrated from generic `PyPDFLoader` to `DoclingLoader` + `HybridChunker` using the `BAAI/bge-small-en-v1.5` tokenizer.
- **Rationale**: University PDFs contain complex structures (multi-column text, room allotment tables, exam schedules). Docling preserves structural context (headings, table associations) while `HybridChunker` ensures chunk boundaries respect the 512-token context window of embedding models.

### 3. ChromaDB Metadata Flattening (`_flatten_docling_metadata`)
- **Decision**: Extract scalar fields (`page_no`, `headings`, `origin_filename`) from Docling's nested `dl_meta` and discard the rest.
- **Rationale**: ChromaDB strictly requires primitive metadata types (`str`, `int`, `float`, `bool`). Passing Docling's raw nested dictionaries crashes vector insertion (`ValueError`).

### 4. Hybrid Retrieval Strategy (`retriever.py`)
- **Decision**: Combine **BM25** (sparse lexical keyword match) and **ChromaDB MMR** (dense semantic match) via LangChain's `EnsembleRetriever` with Reciprocal Rank Fusion (RRF).
- **Weights**: `BM25 = 0.6` (60%), `MMR = 0.4` (40%).
- **Rationale**: University queries frequently feature exact terms (e.g. course codes like `"EE201"`, notice dates, student IDs) where pure semantic vector search fails. BM25 catches exact keyword matches while MMR ensures semantic depth and chunk diversity.

### 5. Deterministic Source Extraction vs. LLM Structured Output (`rag_chain.py`)
- **Decision**: Stream raw markdown tokens directly from the LLM, while extracting citations programmatically from ChromaDB document metadata in Python. Append a `__TOKEN_USAGE__` JSON object at the end of the stream.
- **Rationale**: Using LangChain's `with_structured_output(PydanticModel)` forces the LLM to output full JSON, which **destroys real-time token streaming UX** on the frontend. Furthermore, extracting sources programmatically in Python eliminates LLM hallucinated citations.

### 6. Dual-Mode Model Architecture (`config/settings.py`)
- **Development (`APP_ENV=development`)**: Local **Ollama** embeddings (`qwen3-embedding` or `bge-small-en-v1.5`) + local `llama3.2` LLM. 100% free, offline execution.
- **Production (`APP_ENV=production`)**: Google **Gemini** embeddings (`embedding-001`) + `gemini-1.5-flash` LLM for cloud performance.

### 7. Session Chat Memory & Contextual Query Enhancement (`query_enhancer.py` & `Query.jsx`)
- **Decision**: Store chat message history locally in React frontend state (`messages`) for the duration of the user's session (cleared on page refresh) and pass `chat_history: list[ChatMessage]` in `POST /api/v1/query/stream`. In `query_enhancer.py`, use `MessagesPlaceholder` to inject prior `HumanMessage` / `AIMessage` items into the LLM prompt.
- **Rationale**: Enables multi-turn contextual conversations (e.g., resolving `"What is its syllabus?"` into `"What is the syllabus for Electrical Engineering?"`) without cluttering vector retrieval with multi-turn prompt noise. Vector store search executes cleanly against the single standalone enhanced query.

---

## 4. End-to-End System Workflows

### Workflow A: PDF Ingestion Pipeline
```
[Admin Uploads PDF] ──> POST /api/v1/ingest
                             │
                             ├── 1. Save file to storage/uploads/<college_slug>_<name>.pdf
                             ├── 2. Enqueue job in Redis Queue (RQ) with timeout=1800s (30m)
                             └── 3. Return job_id immediately to frontend (202 Accepted)
                                         │
                             [Frontend polls GET /api/v1/ingest/status/<job_id>]
                                         │
                             [RQ Background Worker Executes]
                                         │
                             ├── a. DoclingLoader parses layout, tables, headings
                             ├── b. HybridChunker splits into ~512 token chunks
                             ├── c. _flatten_docling_metadata extracts scalar metadata
                             ├── d. delete_documents_by_source purges existing chunks (dedup)
                             └── e. add_documents_to_college stores vectors in ChromaDB collection
```

### Workflow B: RAG Query & Token Stream Pipeline
```
[User Asks Question] ──> POST /api/v1/query/stream { question, college_slug, chat_history }
                              │
                              ├── 1. Query Enhancer evaluates chat_history + question via LLM
                              │      (resolves pronouns & context into a single standalone prompt)
                              ├── 2. EnsembleRetriever performs BM25 (60%) + MMR (40%) search on standalone query
                              ├── 3. _format_context builds numbered citation context string
                              ├── 4. RAG_PROMPT enforces closed-domain strict guardrails
                              ├── 5. Stream LLM tokens to client via SSE chunk by chunk
                              ├── 6. Record total query token usage in MySQL (User & College)
                              └── 7. Append `__TOKEN_USAGE__:{sources: [...], tokens: ...}`
                                          │
                               [Frontend Renders]
                               ├── Streamed markdown answer incrementally (ReactMarkdown)
                               └── Interactive source pill links (PDF viewer or web URLs)
```

### Workflow C: Document Deletion & Vector Purging
```
[Admin Clicks Delete] ──> DELETE /api/v1/documents/<college_slug>/<filename>
                              │
                              ├── 1. Verify admin belongs to college_slug
                              ├── 2. Remove physical file from server/storage/uploads/
                              └── 3. Query ChromaDB for source_file == filename & delete vectors
```

---

## 5. Detailed Component Specifications

### 5.1 Configuration & Settings (`server/config/settings.py`)
Centralized Pydantic settings singleton. Manages directory paths (`STORAGE_DIR`, `UPLOAD_DIR`), chunking configurations (`CHUNK_SIZE = 512`), and returns appropriate LangChain LLM & Embedding instances based on `APP_ENV`.

### 5.2 Multi-Tenant Auth & DB (`server/db/` & `server/api/v1/auth.py`)
- **`models.py`**:
  - `User`: `id`, `email`, `hashed_password`, `role` (`admin`/`user`), `college_slug`, `total_tokens_used`, `created_at`.
  - `College`: `id`, `name`, `slug` (unique primary identifier), `total_tokens_used`, `created_at`.
  - `WebLink`: `id`, `college_slug`, `url`, `max_pages`, `pages_crawled`, `chunks_stored`, `status`, `user_id`.
- **`auth.py`**: Generates 7-day JWT tokens signed with `JWT_SECRET_KEY`. Enforces `get_current_user` and `require_admin` dependency guards.

### 5.3 Vector Store Manager (`server/vectorstore/chroma_client.py`)
Handles ChromaDB connection pooling and document insertion. Features dedicated helper functions:
- `get_college_vectorstore(college_slug)`: Retrieves or creates `college_<slug>` collection.
- `delete_documents_by_source(college_slug, source_file)`: Purges all chunks matching a file.
- `delete_documents_by_root_url(college_slug, root_url)`: Purges web crawler vectors matching a root URL.

### 5.4 Retrieval Engine (`server/retrieval/retriever.py`)
Instantiates a dynamic `EnsembleRetriever`:
- Creates `BM25Retriever` from all stored document texts in the collection.
- Configures ChromaDB MMR retriever (`k=top_k`, `fetch_k=20`, `lambda_mult=0.7`).
- Merges results via RRF algorithm.

### 5.5 Query Enhancer (`server/llm/query_enhancer.py`)
Uses a lightweight LLM chain with `MessagesPlaceholder` to clean raw user inputs and resolve conversation history before vector search.
- Fixes typos (e.g. `"syllbusb for elecvtical"` $\rightarrow$ `"What is the syllabus for electrical engineering?"`).
- Resolves contextual pronouns in follow-up queries using session history (e.g. History: *User asks about EE*; Follow-up: *"What is its syllabus?"* $\rightarrow$ *"What is the syllabus for Electrical Engineering?"*).
- Prevents retrieval failures caused by misspelled keywords or ambiguous follow-up phrasing.

### 5.6 RAG Chain & Audit (`server/llm/rag_chain.py` & `server/prompts/rag_prompt.py`)
- **Prompt Constraints**: Closed-domain instructions. If context is insufficient, LLM must output: *"I could not find relevant information in the uploaded institute documents to answer your query."*
- **Token Counter**: Uses `tiktoken` to audit token counts for Enhancer, Embedding, Prompt Context, and Completion Output, atomically persisting usage in MySQL.

### 5.7 Frontend SPA (`web/src/`)
- **`AuthContext.jsx`**: Handles authentication state, token storage, user roles, and login/logout flows.
- **`ProtectedRoute.jsx`**: Protects `/ingest` and `/documents` for admins only.
- **`Query.jsx`**: Chat interface supporting session memory, streaming responses, markdown rendering (`ReactMarkdown` + `remark-gfm`), token audit metrics display, and interactive source document modal views.
- **`Ingest.jsx`**: Drag-and-drop PDF ingestion dashboard with live polling status bar and Crawl4AI website URL crawler submission tab.
- **`Documents.jsx`**: Management console for viewing uploaded PDFs and crawled web links with inline deletion and vector purge actions.

---

## 6. Environment Variables Reference (`.env`)

```env
# Application Environment
APP_ENV=development                    # development | production
PORT=8000
HOST=0.0.0.0

# Security & JWT
JWT_SECRET_KEY=your_super_secret_jwt_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_DAYS=7

# Database (MySQL)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=collage_db

# Redis & Task Queue
REDIS_HOST=localhost
REDIS_PORT=6379

# Development LLM / Embeddings (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=bge-small-en-v1.5

# Production LLM / Embeddings (Google Gemini)
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_EMBEDDING_MODEL=models/embedding-001

# Chunker Configuration
CHUNK_SIZE=512
CHUNK_OVERLAP=100
```

---

## 7. Development & Startup Guide

### Prerequisites
1. Python 3.13+ with `uv` installed (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
2. Node.js 18+ & `npm`
3. Redis Server (`sudo apt install redis-server`)
4. MySQL Server running with `collage_db` database created

### Step-by-Step Launch

#### 1. Start Redis
```bash
redis-server
```

#### 2. Start Background Worker (Server)
```bash
cd server
uv run rq worker
```

#### 3. Start Backend API Server
```bash
cd server
uv run uvicorn app:app --reload
```

#### 4. Start React Frontend
```bash
cd web
npm run dev
```

#### 5. Manual Web Ingestion CLI (Optional Test)
```bash
cd server
uv run python ingestion/web_ingestion.py https://nitjsr.ac.in nit-jamshedpur 15
```

---

## 8. Summary Checklist for New Developers

- [x] **Adding a new endpoint?** Place in `server/api/v1/`, import router in `server/app.py`.
- [x] **Modifying vector ingestion?** Ensure metadata additions in `pdf_ingestion.py` or `web_ingestion.py` pass through `_flatten_docling_metadata()` (only scalar types).
- [x] **Updating LLM prompts?** Edit `server/prompts/rag_prompt.py`. Maintain closed-domain fallback rules.
- [x] **Adding DB columns?** Update models in `server/db/models.py`.
- [x] **Frontend API calls?** Always use `VITE_API_BASE_URL` from environment configuration rather than hardcoded URLs.
