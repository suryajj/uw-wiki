# UW Wiki -- Feature Requirements Document Order

| Field | Value |
|---|---|
| **Project** | UW Wiki |
| **Parent Document** | [PRD v0.1](./PRD.md) |
| **Created** | 2026-04-05 |
| **Purpose** | Define the ordered sequence of FRDs for incremental implementation |

---

## Overview

Each FRD represents a single unit of full functionality that can be implemented, tested, and delivered independently. FRDs are ordered by dependency -- each assumes all prior FRDs are complete. A Setup Document (FRD 0) establishes the project foundation before any feature work begins.

### Ordering Principles

1. **Infrastructure before consumers** -- Database schema and project scaffolding before features that depend on them.
2. **Core content pipeline before AI features** -- Wiki pages and edit proposals before RAG search that indexes them.
3. **Backend before frontend where separable** -- API routes and data models before UI components.

---

## Implementation Order

| # | FRD | PRD Section(s) | Depends On | Delivers |
|---|---|---|---|---|
| 0 | [Setup Document](#frd-0-setup-document) | 10, 11 | -- | Project scaffolding, Supabase setup, DB schema, app shells |
| 1 | [RAG Pipeline](./FRDs/FRD-1-rag-pipeline.md) | 6.1 | FRD 0 | Embedding service, chunking, hybrid retrieval, search_wiki tool, RAG streaming endpoint, re-embedding pipeline |
| 2 | Comments System | 6.5 | FRD 0 | Inline section comments, threaded replies, anchor text management, comment persistence across edits |
| -- | *Additional FRDs TBD* | -- | -- | Wiki pages, PR proposals, directory, Pulse, page claiming, cold start, lifecycle management |

---

## FRD Descriptions

### FRD 0: Setup Document

**Type:** Infrastructure scaffold (not a feature)

**Scope:**

- Next.js 15 App Router project scaffolding
- Supabase project configuration (PostgreSQL 17 + pgvector, Auth, Storage)
- Database schema: initial Supabase migration with all tables from PRD Section 10 (`universities`, `organizations`, `pages`, `page_versions`, `edit_proposals`, `comments`, `pulse_ratings`, `pulse_aggregates`, `external_links`, `users`, `bookmarks`, `notifications`, `lifecycle_config`)
- Supabase client setup (`src/lib/supabase/client.ts`, `server.ts`, `admin.ts`)
- shadcn/ui + TailwindCSS v4 with UW dark theme (PRD Section 12)
- Tiptap editor base configuration
- OpenRouter client setup
- Vercel AI SDK installation
- `.env.example` and environment variable structure
- Root layout with global providers

**Exit criteria:** `npm run dev` starts the Next.js app; Supabase is connected; all tables exist; the layout shell renders with the UW dark theme.

---

### FRD 1: RAG Pipeline

**PRD Section:** 6.1

**Scope:** See [FRD-1-rag-pipeline.md](./FRDs/FRD-1-rag-pipeline.md)

**Exit criteria:** Wiki content is chunkable and embeddable; hybrid search returns relevant results; streaming RAG responses with citations work end-to-end.

---

### FRD 2: Comments System

**PRD Section:** 6.5

**Scope:** TBD -- to be planned after FRD 1 is confirmed.

**Exit criteria:** TBD.

---

## Dependency Graph

```
FRD 0 (Setup)
├── FRD 1 (RAG Pipeline)
├── FRD 2 (Comments System)
├── ... (additional FRDs TBD)
```
