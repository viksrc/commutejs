# Financial Document RAG System — Implementation Plan

## Overview

A Retrieval-Augmented Generation (RAG) system for querying financial documents.
Designed for 1-4 users. ML-heavy stages (embedding, reranking, LLM) are
handled by managed model services — the system focuses on orchestration,
document ingestion, and retrieval.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUERY                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │      Query Pipeline       │
        │  1. Embed query           │
        │  2. Vector search         │
        │  3. Rerank results        │
        │  4. LLM answer generation │
        └────────────┬─────────────┘
                     │
        ┌────────────▼─────────────┐
        │      Vector Store         │
        │  (pgvector or FAISS)      │
        └────────────┬─────────────┘
                     │
        ┌────────────▼─────────────┐
        │    Document Ingestion     │
        │  1. Parse PDF/docs        │
        │  2. Extract text/tables   │
        │  3. Chunk                 │
        │  4. Embed + index         │
        └──────────────────────────┘
```

---

## Stage 1: Document Ingestion Pipeline

### 1a. Document Parsing
- **Input**: PDF, DOCX, XLSX (10-Ks, earnings reports, balance sheets, etc.)
- **Tool**: `pdfplumber` or `pymupdf` (CPU, no GPU needed at this scale)
- **Output**: Raw text + page metadata

### 1b. Table Extraction
- Financial documents are table-heavy — treat tables separately
- Extract tables as structured data (CSV/JSON) and also as text summaries
- Tools: `pdfplumber` (rule-based), or `camelot` for complex tables
- **GPU note**: Table Transformer model is available if rule-based fails,
  but optional for clean digital PDFs

### 1c. Layout-Aware Chunking
- Do NOT chunk naively by token count alone
- Respect document structure: sections, headers, table boundaries
- Strategy:
  - Keep tables as single chunks (with metadata: page, table index)
  - Split prose by section headers first, then by size (512-1024 tokens)
  - Overlap: ~100 tokens between adjacent prose chunks
- Attach metadata to every chunk:
  ```json
  {
    "doc_id": "aapl-10k-2024",
    "page": 12,
    "section": "Risk Factors",
    "chunk_index": 3,
    "chunk_type": "prose" | "table",
    "source_file": "aapl-10k-2024.pdf"
  }
  ```

### 1d. Embedding + Indexing
- Call managed embedding service (no local GPU needed)
- Store vectors + metadata in pgvector (Postgres) or FAISS (file-based)
- **Recommendation for 1-4 users**: pgvector on a small Postgres instance
  is simpler to operate and query with SQL filters

---

## Stage 2: Query Pipeline

### 2a. Query Understanding (optional but valuable)
- Detect query type: factual lookup, comparison, summarization, calculation
- Extract filters: company name, fiscal year, metric name
- Use LLM service for this (fast, cheap with a small prompt)

### 2b. Retrieval
- Embed the query using managed embedding service
- Run ANN search against vector store
- Apply metadata filters if extracted in 2a (e.g., only search AAPL docs)
- Retrieve top-K chunks (K=20 before reranking)

### 2c. Reranking
- Pass query + top-K chunks to managed reranking service
- Reduce to top-N (N=5-8) most relevant chunks
- This step significantly improves answer quality for financial queries
  where keyword overlap is misleading (e.g., "revenue" appears everywhere)

### 2d. Answer Generation
- Build prompt:
  ```
  Context:
  [chunk 1]
  [chunk 2]
  ...

  Question: {user_query}

  Answer with citations (doc name, page number).
  If the answer is not in the context, say so.
  ```
- Call managed LLM service
- Return answer + source citations

---

## Stage 3: API Layer

Simple REST API (Node.js/Express or Python/FastAPI):

```
POST /ingest          — Upload and index a document
GET  /documents       — List indexed documents
DELETE /documents/:id — Remove a document
POST /query           — Ask a question, get an answer
GET  /query/:id       — Retrieve a past query + answer
```

- Auth: simple API key (sufficient for 1-4 users, no OAuth complexity)
- Rate limiting: not needed at this scale

---

## Stage 4: Frontend (optional)

Lightweight UI:
- Document upload + management panel
- Chat interface for querying
- Source citations displayed inline with answers
- Can be a simple React app or even a static HTML page

---

## Technology Choices (Simplified for 1-4 Users)

| Component         | Choice                        | Rationale                              |
|-------------------|-------------------------------|----------------------------------------|
| PDF parsing       | pdfplumber / pymupdf          | Simple, CPU, no dependencies           |
| Table extraction  | pdfplumber (rule-based)       | Sufficient for digital PDFs            |
| Chunking          | Custom (section-aware)        | Better than naive token splitting      |
| Vector store      | pgvector (Postgres)           | SQL filters, easy ops, persistent      |
| Embedding         | Managed service (API)         | No GPU needed locally                  |
| Reranking         | Managed service (API)         | No GPU needed locally                  |
| LLM               | Managed service (API)         | No GPU needed locally                  |
| API framework     | FastAPI (Python) or Express   | Lightweight                            |
| Auth              | API key in header             | Sufficient for small team              |
| Hosting           | Single small VPS or container | Low traffic, no auto-scaling needed    |

---

## GPU Assessment

Since embedding, reranking, and LLM are managed services:

| Stage                    | GPU Benefit?  | Notes                                           |
|--------------------------|---------------|-------------------------------------------------|
| PDF parsing              | No            | CPU is fine                                     |
| Table extraction         | Maybe         | Only if docs are scanned/image-based            |
| OCR (scanned PDFs)       | Optional      | GPU OCR 5-10x faster, only matters for batches |
| Chunking                 | No            | CPU string operations                           |
| Embedding (managed)      | N/A           | Handled by service                              |
| Vector search (pgvector) | No            | CPU is fast enough at this scale                |
| Reranking (managed)      | N/A           | Handled by service                              |
| LLM inference (managed)  | N/A           | Handled by service                              |

**Conclusion**: No local GPU needed for 1-4 users with managed ML services.
Add GPU only if you need to process large batches of scanned (image) PDFs.

---

## Phased Implementation

### Phase 1 — Core (MVP)
- [ ] PDF ingestion pipeline (parse → chunk → embed → store)
- [ ] Basic vector search + LLM answer generation
- [ ] REST API with `/ingest` and `/query` endpoints
- [ ] Simple document metadata tracking

### Phase 2 — Quality
- [ ] Table extraction and structured chunk handling
- [ ] Reranking integration
- [ ] Query understanding / metadata filtering
- [ ] Source citations in answers

### Phase 3 — Usability
- [ ] Simple web UI (upload + chat)
- [ ] Document management (list, delete)
- [ ] Query history

### Phase 4 — Hardening (if needed)
- [ ] Error handling and retries for managed service calls
- [ ] Ingestion status tracking (async job queue)
- [ ] Basic monitoring / logging

---

## Out of Scope (kept simple for 1-4 users)

- Multi-tenancy / user isolation
- OAuth / SSO
- Auto-scaling infrastructure
- Streaming LLM responses (nice-to-have, not essential)
- Fine-tuning any models
- Complex hybrid search (BM25 + vector) — pure vector + reranking is sufficient
