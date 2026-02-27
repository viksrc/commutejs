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
- **Tool**: **Docling** (IBM) — best-in-class for financial documents
  - Uses DocLayNet for layout analysis and TableFormer for table recognition
  - **Granite-Docling-258M** (released late 2025) is the recommended backend:
    a 258M parameter vision-language model, CPU-runnable, MIT-licensed
  - Achieves **97% TEDS on FinTabNet** (financial table benchmark)
  - Outputs clean Markdown or structured JSON — no custom parsing needed
  - Replaces the need for separate table extraction and chunking libraries
- **Output**: Structured JSON with sections, tables, and metadata preserved

### 1b. Table Extraction
- Handled automatically by Docling/Granite-Docling — no separate tool needed
- Tables are output as structured data alongside prose sections
- **97.9% accuracy on complex table extraction** (third-party benchmark vs
  75% for alternatives like Unstructured)
- Fallback for scanned/image PDFs: Docling includes built-in OCR support

### 1c. Layout-Aware Chunking
- Docling outputs pre-structured content — use its native chunking rather
  than building custom logic
- Still enforce metadata on every chunk:
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
- For prose chunks that exceed token limits, apply a secondary split with
  ~100 token overlap after Docling's structural pass

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
| PDF parsing       | Docling + Granite-Docling-258M| Best accuracy on financial docs, CPU   |
| Table extraction  | Docling (built-in TableFormer)| 97% TEDS on FinTabNet, no extra lib    |
| Chunking          | Docling native + size split   | Structure-aware, less custom code      |
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
| PDF parsing (Docling)    | No            | Granite-Docling-258M runs well on CPU           |
| Table extraction         | No            | TableFormer inside Docling is CPU-viable        |
| OCR (scanned PDFs)       | Optional      | Docling has built-in OCR; GPU speeds it up      |
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
