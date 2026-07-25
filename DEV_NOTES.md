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

### 6. Hybrid Retrieval System (`retriever.py`)
- Combines **Sparse Lexical Search** (BM25) and **Dense Semantic Search** (MMR via ChromaDB) into a hybrid pipeline using LangChain's `EnsembleRetriever`.
- Uses **Reciprocal Rank Fusion (RRF)** to merge and re-rank document chunks.
- **Priority Weighting**: Configured with `BM25 = 0.6` (60% weight for exact keyword matching like course codes, notice dates, and names) and `MMR = 0.4` (40% weight for dense semantic understanding and chunk diversity).

### 7. Strict Guardrails & Memory-less RAG Chain (`rag_chain.py` & `rag_prompt.py`)
- Built using LangChain Expression Language (LCEL).
- **Strict Context Boundary**: System prompt explicitly forbids the LLM from using its internal pre-trained memory or general training data about the institute or any topic.
- **Zero-Vector Fallback**: If vector search returns 0 relevant chunks, context is set to `NO_RELEVANT_DOCUMENTS_FOUND` and the assistant answers strictly: *"I could not find relevant information in the uploaded institute documents to answer your query."*
- **Citations**: Returns 1-indexed source document and page number citations at the end of answers.
- **Real-Time Streaming**: Token-by-token streaming via `StreamingResponse` for smooth real-time answers.

### 8. Document Serving & Admin Document Management (`documents.py` & `Documents.jsx`)
- **Public Document Viewer (`GET /api/v1/documents/view/{filename}`)**: Serves PDFs inline (`Content-Disposition: inline`) from `storage/uploads` so any user can click source citations in the query assistant to open the exact source PDF in a new tab.
- **Admin Document Dashboard (`/documents`)**:
  - Lists all uploaded PDF files matching the admin's `college_slug`.
  - Displays file size, upload timestamp, and inline PDF view link.
  - **Secure Deletion (`DELETE /api/v1/documents/{college_slug}/{filename}`)**: Admin-restricted endpoint that validates the admin's assigned `college_slug` before deleting the file from disk AND purging all vector chunks from ChromaDB.

### 9. React Frontend with AuthContext & Role-Based Access Control
- **`AuthContext.jsx`**: Global React Context managing user sessions, roles (`admin` vs `user`), and JWT persistence in `localStorage`.
- **`ProtectedRoute.jsx`**: Route guard component restricting access:
  - **`Admin` Role**: Exclusive access to PDF Ingestion (`/ingest`) and Document Management (`/documents`).
  - **`User` / `Admin` Role**: Access to Query Assistant (`/query`) with automatic pre-filling of `college_slug`.
- **Restructured Navigation**:
  - `/` — COLLAGE Landing Page introducing the platform philosophy & workflow.
  - `/ingest` — PDF Drag-and-Drop Ingestion & RQ Job Polling Tracker (Admin Only).
  - `/documents` — Uploaded Document Management & Vector Chunk Purging (Admin Only).
  - `/query` — Real-time RAG Query Assistant with Interactive Source PDF Citations (Authenticated Users & Admins).
  - `/login` & `/register` — Account authentication & role creation.
### 10. End-to-End RAG Token Usage Auditing & Analytics (`token_counter.py` & `rag_chain.py`)
- **Multi-Stage Token Counter**: Tracks token consumption across all 4 stages of a RAG query:
  1. **Query Enhancer**: Prompt & rewritten question token count.
  2. **Embedding Model**: Dense vector query representation tokens.
  3. **RAG Prompt & Context**: System prompt + formatted context payload tokens.
  4. **LLM Output Stream**: Real-time answer generation completion tokens.
- Uses `tiktoken` (`cl100k_base` / `o200k_base`) with character-ratio fallbacks for local and cloud models.
- Streams a final JSON token usage audit object (`__TOKEN_USAGE__:{...}`) over the SSE text stream.

### 11. Database Token Accounting & User Analytics (`db/models.py` & `db/crud.py`)
- **Cumulative Persistence**: Added `total_tokens_used` columns to both `User` and `College` models in MySQL via SQLAlchemy ORM.
- **Atomic Increments**: `record_token_usage()` increments user and institute token totals after each query stream completes.
- **Account Profile Modal (`ProfileModal.jsx`)**: Rendered via `ReactDOM.createPortal` (escaping backdrop-blur stacking contexts). Displays user details, assigned institute, account creation date, and total cumulative tokens consumed with a live refresh button.

### 12. Dual-Purge Vector Storage Cleanup & Custom Confirm Dialog (`documents.py` & `confirm-dialog.jsx`)
- **Dual Cleanup**: Deleting an institute document purges the physical file from `storage/uploads` AND deletes all corresponding vector chunks from the ChromaDB collection using `source_file` metadata filtering.
- **Shadcn Confirm Dialog**: Replaced default browser `window.confirm()` with an accessible Tailwind/Shadcn confirmation modal.
- **Centralized Environment URLs**: Migrated hardcoded API base URLs across all frontend components (`AuthContext`, `Documents`, `Ingest`, `Query`) to consume `VITE_API_BASE_URL`.

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

### 13. Manual Web Crawling Tool (`crawl_tool.py`)
- **Purpose**: Standalone CLI script for manual testing of college website crawling. Stores results in a `results[]` array for inspection without touching ChromaDB.
- **Technology**: [Crawl4AI](https://github.com/unclecode/crawl4ai) 0.9.2 — Playwright-based headless browser with stealth mode to bypass anti-bot protections on JavaScript-rendered university websites.
- **Features**:
  - BFS (Breadth-First Search) crawling following internal links up to `max_pages` limit.
  - Stealth mode (`enable_stealth=True`) + `magic=True` for JS-rendered React/Angular university sites.
  - Internal link extraction via BeautifulSoup parsing of rendered HTML (handles JS-rendered anchor tags).
  - Excludes nav, footer, scripts, styles to reduce noise.
  - Per-page result dict: `url`, `title`, `markdown`, `links`, `success`, `error`.
- **Usage**: `uv run python crawl_tool.py <URL> [max_pages]`

### 14. Web Content Ingestion Pipeline (`ingestion/web_ingestion.py`)
- **Purpose**: Full ingestion pipeline that crawls a college website and stores the content in ChromaDB alongside PDF chunks — searchable via the same RAG query interface.
- **Pipeline Flow**: `URL → Crawl4AI (JS render, stealth) → BFS internal link discovery → MarkdownTextSplitter → metadata injection → ChromaDB`
- **Chunking**: Uses `MarkdownTextSplitter` with the same `CHUNK_SIZE` / `CHUNK_OVERLAP` from `settings.py` as the PDF pipeline.
- **Metadata Schema** (per chunk):
  - `college_slug` — routes to the correct ChromaDB collection.
  - `source_file` — set to the crawled URL; enables `delete_documents_by_source()` dedup on re-crawl.
  - `source_url` — full page URL used for query citations.
  - `source_type` — `"web"` (distinguishes web vs. PDF chunks for future filtering).
  - `title` — page `<title>` tag content.
- **Key Design**: Web chunks go into the same `college_{slug}` ChromaDB collection as PDFs. A single RAG query searches both sources simultaneously.
- **Usage**: `uv run python ingestion/web_ingestion.py <URL> <college_slug> [max_pages]`
- **Planned Enhancements**: Sitemap-first URL discovery, URL pattern filtering, concurrent crawling with `arun_many()`, PDF link harvesting, content dedup via hashing, crawl depth limiting.

### 15. Web Ingestion API & Dual Storage Management (`WebLink` MySQL + ChromaDB Purge)
- **Database Tracking (`web_links` table)**:
  - Tracks web crawler requests submitted by admins: `id`, `college_slug`, `url` (official root link), `max_pages`, `pages_crawled`, `chunks_stored`, `status`, `user_id`, `created_at`.
- **API Endpoints**:
  - `POST /api/v1/ingest/web`: Receives `url`, `max_pages`, `college_slug`. Validates admin role, records entry in MySQL (`status="processing"`), and runs background Crawl4AI web ingestion.
  - `GET /api/v1/ingest/web/links/{college_slug}`: Retrieves all web links ingested for the college.
  - `DELETE /api/v1/ingest/web/links/{link_id}`: Deletes the link entry from MySQL AND purges all vector chunks matching `root_url` and `college_slug` from ChromaDB via `delete_documents_by_root_url()`.
- **Frontend Integration (`Ingest.jsx` & `Documents.jsx`)**:
  - **Ingest Page**: Added dedicated **Website Crawler (Crawl4AI)** tab for entering college URLs, configuring max pages, and submitting ingestion jobs.
  - **Documents Page**: Added **Crawled Web Links** tab displaying URL, crawl stats, chunks stored, and a **Delete Link & Purge Embeddings** action backed by `ConfirmDialog`.

### 16. Structured RAG Output & Markdown Formatting (`RAGResponse` + `ReactMarkdown`)
- **Pydantic Model (`RAGResponse`)**:
  - Defined in `server/llm/rag_chain.py`: `content: str` (markdown answer) and `sources: list[str]` (unique source URLs or uploaded PDF filenames).
- **Metadata Source Extraction**:
  - Automatically extracts `source_url` (for web crawls) or `source_file` (for PDF uploads) from ChromaDB retrieved vector chunks.
- **Frontend Markdown & Dynamic Source Rendering (`Query.jsx`)**:
  - Integrates `ReactMarkdown` with `remark-gfm` for full markdown rendering (`**bold**`, bulleted lists, numbered lists, section headings).
  - Displays a dedicated **Sources Referenced** container rendering items as interactive pill links:
    - **Web URLs**: Clicking opens the target website in a new tab (`target="_blank"`).
    - **PDF Files**: Clicking opens the document via `/api/v1/documents/view/{filename}` in a new tab (`target="_blank"`).

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

### 5. Web Ingestion (Manual CLI)
```bash
cd server
uv run python ingestion/web_ingestion.py <URL> <college_slug> [max_pages]
# Example:
uv run python ingestion/web_ingestion.py https://nitjsr.ac.in nit-jamshedpur 15
```

### 6. Web Crawler Test Tool (Manual CLI)
```bash
cd server
uv run python crawl_tool.py <URL> [max_pages]
# Example:
uv run python crawl_tool.py https://nitjsr.ac.in 10
```

---

## Future Roadmap / Pending Items
- Add multi-turn conversational memory using `RedisChatMessageHistory` and `RunnableWithMessageHistory`.
- Containerize FastAPI, Redis, MySQL, and RQ Worker with `docker-compose`.
- Implement sitemap.xml-first URL discovery in `web_ingestion.py`.
- Add URL pattern filter (`allow_patterns`) to restrict web crawling to relevant site sections.
- Implement concurrent page crawling via Crawl4AI `arun_many()` for 3–5× speed improvement.
- Auto-detect and harvest `.pdf` links found during web crawling → route them to `pdf_ingestion.py`.
- Expose web ingestion as an admin API endpoint (similar to the PDF ingestion endpoint).
