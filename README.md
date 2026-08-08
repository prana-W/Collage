# 🎓 COLLAGE: Multi-Tenant University RAG Platform

> **Unifying scattered campus knowledge into a unified, isolated, and intelligent RAG engine.**

COLLAGE (a wordplay on "College") is a multi-tenant, enterprise-grade Retrieval-Augmented Generation (RAG) platform designed specifically for universities and educational institutes. It ingests complex campus documents—such as multi-column syllabi, room allotment tables, exam schedules, and web portals—and provides student/admin AI query assistants with strict context guardrails, real-time streaming, and interactive source citations.

---

## 🌟 Key Features

- 🛡️ **Multi-Tenant Isolation**: Physical collection partitioning in ChromaDB (`college_<slug>`) and tenant scoping in MySQL. Zero data leak between institutes.
- 📄 **Layout-Aware PDF Ingestion**: Leverages **Docling** and **HybridChunker** (`BAAI/bge-small-en-v1.5` tokenizer) for layout, table, and heading-aware semantic chunking bounded to 512-token context windows.
- 🌐 **Web Content Scraper (Crawl4AI)**: Playwright-backed stealth crawler capable of parsing JavaScript-rendered university portals and notice boards into indexed Markdown vectors.
- 🔍 **Hybrid Ensemble Retrieval**: Combines **BM25** (60% weight for exact course codes, notice dates, and names) and **ChromaDB MMR** (40% weight for semantic intent and chunk diversity) via Reciprocal Rank Fusion (RRF).
- ⚡ **Real-Time Token Streaming**: Token-by-token server-sent stream for zero latency UX, appended with an uncheatable token audit payload (`__TOKEN_USAGE__`).
- 🔗 **Interactive Citations**: Renders exact source document links (web URLs or inline PDF view popups) alongside AI responses.
- 📊 **Token Usage Accounting**: Tracks and persists 4-stage token metrics (Query Enhancer, Embedding, Context Prompt, Stream Output) per user and per college in MySQL.
- 🔄 **Dual Execution Modes**: 
  - **Development**: 100% free, offline execution using local **Ollama** (`llama3.2` + `bge-small-en-v1.5`).
  - **Production**: High-speed cloud deployment using **Google Gemini API** (`gemini-1.5-flash` + `embedding-001`).
- ⏱️ **Asynchronous Task Processing**: Powered by Redis Queue (RQ) with extended 30-minute timeouts for handling multi-page PDFs cleanly in background worker threads.

---

## 🏗️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │                     React Frontend                     │
               │         (Vite + TailwindCSS + Lucide Icons)            │
               └───────────────────────────┬────────────────────────────┘
                                           │ HTTP / SSE Stream
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FastAPI Backend Server                                 │
│                                                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │   Auth & Multi-      │    │  Docling & Crawl4AI  │    │   Hybrid Ensemble        │  │
│  │   Tenant Router      │    │   Ingestion Engine   │    │   Retriever Engine       │  │
│  │  (/api/v1/auth)      │    │  (/api/v1/ingest)     │    │  (BM25 60% + MMR 40%)    │  │
│  └──────────┬───────────┘    └──────────┬───────────┘    └────────────┬─────────────┘  │
└─────────────┼───────────────────────────┼─────────────────────────────┼────────────────┘
              │                           │                             │
              ▼                           ▼                             ▼
    ┌───────────────────┐       ┌───────────────────┐         ┌───────────────────┐
    │   MySQL Database  │       │ Redis Queue (RQ)  │         │ Persistent        │
    │ (Users, Colleges, │       │  Ingestion Worker │         │ ChromaDB Store    │
    │  Token Analytics) │       │ (Background Tasks)│         │ (college_<slug>)  │
    └───────────────────┘       └───────────────────┘         └───────────────────┘
```

---

## 🛠️ Technology Stack

| Domain | Technologies |
|---|---|
| **Backend** | FastAPI (Python 3.13), Pydantic v2, `uv` Package Manager |
| **Database** | MySQL, SQLAlchemy 2.0 ORM, PyMySQL |
| **Vector DB** | ChromaDB (Isolated persistent collections per college) |
| **AI & RAG** | LangChain (LCEL), Docling, HybridChunker, Tiktoken |
| **Web Scraping** | Crawl4AI 0.9.2 (Playwright + Stealth Mode + BeautifulSoup) |
| **Task Queue** | RQ (Redis Queue), Redis Server |
| **Frontend** | React 18, Vite, TailwindCSS, React Router v6, Lucide Icons |
| **LLM & Vectors** | Ollama (Local Dev) / Google Gemini (Cloud Prod) |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.13+** with [`uv`](https://github.com/astral-sh/uv) installed
- **Node.js 18+** & `npm`
- **Redis Server** (`redis-server`)
- **MySQL Server** with a database created named `collage_db`

---

### 1. Clone & Configure Environment

```bash
git clone https://github.com/your-username/Collage.git
cd Collage
```

Copy the sample environment file in `server/`:

```bash
cp server/.env.sample server/.env
```

Edit `server/.env` with your credentials:

```env
APP_ENV=development                    # development | production
PORT=8000

# Database Credentials
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=collage_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Security
JWT_SECRET_KEY=your_super_secret_jwt_key_here

# Local AI Models (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=bge-small-en-v1.5
```

---

### 2. Run Services

#### Step A: Start Redis
```bash
redis-server
```

#### Step B: Start RQ Ingestion Worker
```bash
cd server
uv run rq worker
```

#### Step C: Start FastAPI Backend
```bash
cd server
uv run python app.py
```
*Backend API will run at `http://localhost:8001` (Swagger docs available at `http://localhost:8001/docs`).*

#### Step D: Start React Frontend
```bash
cd web
npm install
npm run dev
```
*Frontend app will run at `http://localhost:5166`.*

---

## 🛰️ Key API Endpoints

### 🔐 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register new user/admin account.
- `POST /api/v1/auth/login` — Authenticate and receive 7-day JWT Bearer token.
- `GET /api/v1/auth/me` — Fetch currently authenticated user profile & token usage.

### 📥 Document & Web Ingestion (`/api/v1/ingest`)
- `POST /api/v1/ingest` — Upload PDF documents for background Docling parsing.
- `GET /api/v1/ingest/status/{job_id}` — Poll background RQ job progress.
- `POST /api/v1/ingest/web` — Trigger Crawl4AI website scraper for college URLs.
- `GET /api/v1/ingest/web/links/{college_slug}` — Retrieve ingested web crawler links.

### 🔍 Query Assistant (`/api/v1/query`)
- `POST /api/v1/query/stream` — Real-time Server-Sent Events (SSE) token stream for user queries.

### 📂 Document Management (`/api/v1/documents`)
- `GET /api/v1/documents/list/{college_slug}` — List uploaded PDFs for a college.
- `GET /api/v1/documents/view/{filename}` — View PDF inline with source highlight.
- `DELETE /api/v1/documents/{college_slug}/{filename}` — Purge document from disk AND ChromaDB vectors.

---

## 📖 Developer Documentation

For an exhaustive, file-by-file codebase specification, sequence diagrams, and deep architectural notes, read [DEV_NOTES.md](./DEV_NOTES.md).

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
