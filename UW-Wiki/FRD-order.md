# UW Wiki -- Feature Requirements Document Order

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                            |
| **Parent Document** | [PRD v0.1](./PRD.md)                                               |
| **Created**         | 2026-04-05                                                         |
| **Purpose**         | Define the ordered sequence of FRDs for incremental implementation |

---

## Overview

Each FRD represents a single unit of full functionality that can be implemented, tested, and delivered independently. FRDs are ordered by dependency -- each assumes all prior FRDs are complete. A Setup Document (FRD 0) establishes the project foundation before any feature work begins.

### Ordering Principles

1. **Infrastructure before consumers** -- Database schema and project scaffolding before features that depend on them.
2. **Core content pipeline before AI features** -- Wiki pages and edit proposals before RAG search that indexes them.
3. **Backend before frontend where separable** -- API routes and data models before UI components.

---

## Implementation Order

| #   | FRD                                                                           | PRD Section(s)          | Depends On                 | Delivers                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------- | ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | [Setup Document](#frd-0-setup-document)                                       | 10, 11                  | --                         | Project scaffolding, Supabase setup, DB schema, app shells                                                                                                                   |
| 1   | [RAG Pipeline](./FRDs/FRD-1-rag-pipeline.md)                                  | 6.1                     | FRD 0                      | Embedding service, chunking, hybrid retrieval, search_wiki tool, RAG streaming endpoint, re-embedding pipeline                                                               |
| 2   | [Wiki Pages, Directory, Editor, and Core Page UX](./FRDs/FRD-2-wiki-pages.md) | 6.2, 6.3, 6.6, 6.7, 6.9 | FRD 0                      | Browsable directory, three-column wiki page view, Tiptap editor primitives, Pulse sidebar + voting, lifecycle banners, page claiming, version history shell                  |
| 3   | [Comments System](./FRDs/FRD-3-comments-system.md)                            | 6.5                     | FRD 0, FRD 2               | Inline section comments, threaded replies, anchor text management, comment persistence across edits                                                                          |
| 4   | [PR-Edit System (Section-Scoped)](./FRDs/FRD-4-pr-edit-system.md)             | 6.3, 6.4, 7, 8, 9       | FRD 0, FRD 1, FRD 2, FRD 3 | Section-scoped edit proposals, contributor rationale, AI pre-screen visibility, reviewer accept/reject decisions, conflict-of-interest enforcement, patchset/rebase workflow |
| --  | _Additional FRDs TBD_                                                         | --                      | --                         | Cold start agent                                                                                                                                                             |

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

### FRD 2: Wiki Pages, Directory, Editor, and Core Page UX

**PRD Sections:** 6.2, 6.3, 6.6, 6.7, 6.9

**Scope:** See [FRD-2-wiki-pages.md](./FRDs/FRD-2-wiki-pages.md)

**Exit criteria:** Directory renders with grid/list toggle and category sections; wiki pages render in three-column layout (TOC, content, Pulse sidebar); Tiptap inline editor base works with image upload and autosave; lifecycle banners; page claiming with Official section; version history shell.

---

### FRD 3: Comments System

**PRD Section:** 6.5

**Scope:** See [FRD-3-comments-system.md](./FRDs/FRD-3-comments-system.md)

**Exit criteria:** Inline text-anchored comments with Medium-style text selection; margin indicators per H2 section; comments sidebar with document-position sorting; bottom section with Most Recent / Top Voted sorting; two-level threading; upvote/downvote voting (account required); exact-match re-anchoring with orphaned comment handling; highlighting system (light on sidebar open, dark on selection); basic markdown formatting; 1500-char limit; anonymous-by-default attribution; post-hoc moderation with reporting; RAG integration with comment chunks.

---

### FRD 4: PR-Edit System (Section-Scoped)

**PRD Sections:** 6.3, 6.4, 7, 8, 9

**Scope:** See [FRD-4-pr-edit-system.md](./FRDs/FRD-4-pr-edit-system.md)

**Exit criteria:** Contributors can propose edits to a specific section with rationale; AI pre-screen verdict is visible to contributor and reviewers; reviewer performs final accept/reject decision; affiliated reviewers cannot accept own-org proposals; stale proposals require rebase patchset; accepted proposals create new page versions and trigger FRD 1/3 downstream updates.

---

## Dependency Graph

```
FRD 0 (Setup)
├── FRD 1 (RAG Pipeline)
├── FRD 2 (Wiki Pages, Directory, Editor, Core Page UX)
│   └── FRD 3 (Comments System)
│       └── FRD 4 (PR-Edit System)
├── ... (additional FRDs TBD)
```
