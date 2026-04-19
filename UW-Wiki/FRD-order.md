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
| 5   | [Cold Start Agent](./FRDs/FRD-5-cold-start-agent.md)                          | 6.8, 6.6, 13            | FRD 0, FRD 2               | Admin-triggered agent: org identification (name or URL), Tavily web research, ProseMirror JSON synthesis, Pulse seeding, draft preview and publish flow                      |
| 6   | [Auth UI and Pending Action Preservation](./FRDs/FRD-6-auth-ui.md)            | 9, 12                   | FRD 0                      | `/auth/sign-in` page, AuthModal component, signup with magic-link verification, passwordless magic-link sign-in, password reset, Google OAuth, sign-out, header user state, pending-action localStorage (24h TTL) with auto-resume, `returnTo` routing, guard redirects, `/my/*` stubs |
| 7   | [Admin Dashboard and Moderation](./FRDs/FRD-7-admin-dashboard.md)             | 6.7, 6.8, 7, 8          | FRD 0, FRD 2, FRD 3, FRD 4, FRD 5, FRD 6 | Reviewer PR queue, page claim approval, cold-start job history, lifecycle config editor, user role management, comment moderation queue                              |
| 8   | [Bookmarks and Contribution History](./FRDs/FRD-8-bookmarks.md)               | 9                       | FRD 0, FRD 2, FRD 4, FRD 6 | Bookmark toggle (wiki page header + API), `/my/bookmarks` page, `/my/contributions` PR history page                                                                    |

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

### FRD 5: Cold Start Agent

**PRD Sections:** 6.8, 6.6, 13

**Scope:** See [FRD-5-cold-start-agent.md](./FRDs/FRD-5-cold-start-agent.md)

**Exit criteria:** Admin can identify a UW org by name or URL via smart input; confirmation card is editable; research runs with step-by-step progress tracking; synthesis produces valid ProseMirror JSON and Pulse estimates; draft preview renders correctly; publish creates org + page + page_version + Pulse seed ratings; published page displays with AI-generated banner; non-admin access is blocked; rate limiting prevents runaway costs.

---

### FRD 6: Auth UI and Pending Action Preservation

**PRD Sections:** 9 (Identity and Authentication), 12 (UX and UI Design)

**Scope:** See [FRD-6-auth-ui.md](./FRDs/FRD-6-auth-ui.md)

**Unblocks:** User-facing write paths in FRD 2 (PR submit), FRD 3 (comment submit + vote), FRD 4 (PR submit), FRD 5 (admin access).

**Exit criteria:** `/auth/sign-in` page renders AuthModal as embedded card; header shows Sign In button (unauth) or avatar dropdown (auth); Google OAuth sign-in works end-to-end; email/password sign-up creates account and sends magic-link verification; passwordless magic-link sign-in works; password reset flow works end-to-end; pre-verified users can still comment/vote/submit PRs; verify-email banner appears and disappears after verification; pending actions (comment submit, comment vote, PR submit, bookmark toggle) survive OAuth redirect and auto-resume on first authenticated load; pending action survives browser close and new-tab sign-in within 24h; pending action is discarded after 24h; `returnTo` is sanitized to local paths; unauthenticated user hitting `/admin/*` is redirected to sign-in with returnTo; non-admin user hitting `/admin/*` is redirected to home with error toast; display name validation rejects invalid inputs; AuthModal meets WCAG 2.1 AA; Supabase dashboard checklist executed; branded email templates applied.

---

### FRD 7: Admin Dashboard and Moderation

**PRD Sections:** 6.7, 6.8, 7, 8

**Scope:** See [FRD-7-admin-dashboard.md](./FRDs/FRD-7-admin-dashboard.md)

**Depends on:** FRD 0, FRD 2, FRD 3, FRD 4, FRD 5, FRD 6

**Surfaces:**
- **Reviewer queue** — paginated list of pending edit proposals with section diff cards, AI pre-screen verdict display, accept / reject / request-changes actions, conflict-of-interest enforcement
- **Page claim approval queue** — review org claim requests, approve or deny with reason
- **Cold-start job history** — view past and in-progress cold-start jobs, re-run failed jobs, view generated drafts
- **Lifecycle config editor** — view and update per-category staleness thresholds; per-org threshold overrides
- **User role management** — promote/demote users between viewer / reviewer / admin roles
- **Comment moderation queue** — review reported comments, dismiss report, hide comment, ban user

**Exit criteria:** All six admin surfaces render behind `requireAdmin()` / `requireReviewer()` guards; reviewer can accept and reject PRs end-to-end; page claim approval updates org `is_claimed`; conflict-of-interest check blocks affiliated reviewers; cold-start job history is paginated and shows live job status; lifecycle config saves to `lifecycle_config` table; role promotion persists to `public.users`; reported comments can be hidden from `comment_reports` queue.

---

### FRD 8: Bookmarks and Contribution History

**PRD Section:** 9

**Scope:** See [FRD-8-bookmarks.md](./FRDs/FRD-8-bookmarks.md)

**Depends on:** FRD 0, FRD 2, FRD 4, FRD 6

**Note:** FRD 6 delivers `/my/bookmarks` and `/my/contributions` as "Coming Soon" stubs and defines the `bookmark.toggle` pending action. This FRD implements the backing feature.

**Delivers:** Bookmark toggle button in wiki page header; `POST /api/bookmarks/toggle` server action; `/my/bookmarks` page listing saved pages; `/my/contributions` page listing the authenticated user's edit proposals with status (pending / accepted / rejected).

**Exit criteria:** Bookmark button appears on wiki pages for authenticated users; toggle saves / removes from `bookmarks` table; `/my/bookmarks` lists all saved pages with org name, category, and last-edited date; `/my/contributions` lists all user PRs with section names, status badge, and link to the proposal; unauthenticated users are redirected to sign-in with returnTo.

```
FRD 0 (Setup)
├── FRD 1 (RAG Pipeline)
├── FRD 2 (Wiki Pages, Directory, Editor, Core Page UX)
│   └── FRD 3 (Comments System)
│       └── FRD 4 (PR-Edit System)
├── FRD 5 (Cold Start Agent) [depends on FRD 0 + FRD 2]
├── FRD 6 (Auth UI) [depends on FRD 0; unblocks write paths in FRDs 2, 3, 4, 5]
│   └── FRD 7 (Admin Dashboard & Moderation) [depends on FRD 0, 2, 3, 4, 5, 6]
│       └── FRD 8 (Bookmarks & Contribution History) [depends on FRD 0, 2, 4, 6]
```

> **Note on External Links (formerly FRD 10):** The External Links section (PRD Appendix B) is specified directly within FRD 2. No separate FRD is needed — the `external_links` table schema is already in FRD 0 and the rendering logic belongs to the wiki page UX.
