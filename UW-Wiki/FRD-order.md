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

| #   | FRD                                                                           | PRD Section(s)              | Depends On                 | Delivers                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------- | --------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | [Setup Document](#frd-0-setup-document)                                       | 9, 10, 11, 12               | --                         | Project scaffolding, Supabase setup, DB schema, app shells                                                                                                                                                                        |
| 1   | [RAG Pipeline](./FRDs/FRD-1-rag-pipeline.md)                                  | 6.1                         | FRD 0                      | Embedding service, chunking, hybrid retrieval, search_wiki tool, RAG streaming endpoint, re-embedding pipeline                                                                                                                    |
| 2   | [Wiki Pages, Directory, Editor, and Core Page UX](./FRDs/FRD-2-wiki-pages.md) | 6.2, 6.3, 6.4, 6.6, 6.7, 6.9 | FRD 0                    | Browsable directory, three-column wiki page view, Tiptap editor primitives, Pulse sidebar + voting, lifecycle banners, page claiming, version history shell, external links section. **Note: PR submission UI and reviewer dashboard in FRD 2 are superseded by FRD 4.** |
| 3   | [Comments System](./FRDs/FRD-3-comments-system.md)                            | 6.5                         | FRD 0, FRD 2               | Inline section comments, threaded replies, anchor text management, comment persistence across edits                                                                                                                               |
| 4   | [PR-Edit System (Section-Scoped)](./FRDs/FRD-4-pr-edit-system.md)             | 6.3, 6.4, 7, 8, 9           | FRD 0, FRD 1, FRD 2, FRD 3 | Section-scoped edit proposals (single or multi-section), contributor rationale, AI pre-screen, reviewer accept / reject / request-changes decisions, `changes_requested` workflow, conflict-of-interest enforcement, patchset/rebase workflow |
| 5   | [Cold Start Agent](./FRDs/FRD-5-cold-start-agent.md)                          | 6.8, 6.6, 13                | FRD 0, FRD 2               | Admin-triggered agent: org identification (name or URL), Tavily web research, ProseMirror JSON synthesis, Pulse seeding, draft preview and publish flow                                                                           |
| 6   | [Auth UI and Pending Action Preservation](./FRDs/FRD-6-auth-ui.md)            | 9, 12                       | FRD 0                      | `/auth/sign-in` page, AuthModal component, signup with magic-link verification, passwordless magic-link sign-in, password reset, Google OAuth, sign-out, header user state, pending-action localStorage (24h TTL) with auto-resume, `returnTo` routing, guard redirects, `/my/*` stubs |
| 7   | [Admin Dashboard and Moderation](./FRDs/FRD-7-admin-dashboard.md)             | 6.7, 6.8, 7, 8              | FRD 0, FRD 2, FRD 3, FRD 4, FRD 5, FRD 6 | Reviewer PR queue (accept / reject / request-changes), page claim approval, cold-start job history + re-run, lifecycle config editor, user role + affiliation management, comment moderation (hide-only), `admin_activity_log` audit trail. **Requires amendments to FRD 2, 3, 4, 5 — see Amendment Tracker below.** |
| 8   | [Bookmarks and Contribution History](./FRDs/FRD-8-bookmarks.md)               | 9                           | FRD 0, FRD 2, FRD 4, FRD 6 | Bookmark toggle (wiki page header + route handler), `/my/bookmarks` page, `/my/contributions` PR history page with all status states                                                                                             |

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

**PRD Sections:** 6.2, 6.3, 6.4, 6.6, 6.7, 6.9

**Scope:** See [FRD-2-wiki-pages.md](./FRDs/FRD-2-wiki-pages.md)

**Supersession note:** FRD 2 contains early drafts of the PR submission flow, diff generation, and reviewer dashboard (Sections 5–8 and the `/admin/proposals` route). These sections are **superseded by FRD 4**, which is the canonical source of truth for all proposal workflow logic. When implementing, defer to FRD 4 for any proposal/reviewer behavior. FRD 2's UI/routing stubs serve as scaffolding only.

**Exit criteria:** Directory renders with grid/list toggle and category sections; wiki pages render in three-column layout (TOC, content, Pulse sidebar); Tiptap inline editor base works with image upload and autosave; lifecycle banners; page claiming with Official section; version history shell.

---

### FRD 3: Comments System

**PRD Section:** 6.5

**Scope:** See [FRD-3-comments-system.md](./FRDs/FRD-3-comments-system.md)

**Supersession note:** FRD 3's original `/api/admin/reports/[id]/resolve` endpoint (which described comment deletion) is superseded by FRD 7, which replaces it with two explicit endpoints: `/api/admin/comments/[id]/hide` (hide-only, no deletion) and `/api/admin/reports/[id]/dismiss`.

**Exit criteria:** Inline text-anchored comments with Medium-style text selection; margin indicators per H2 section; comments sidebar with document-position sorting; bottom section with Most Recent / Top Voted sorting; two-level threading; upvote/downvote voting (account required); exact-match re-anchoring with orphaned comment handling; highlighting system (light on sidebar open, dark on selection); basic markdown formatting; 1500-char limit; anonymous-by-default attribution; post-hoc moderation with reporting; RAG integration with comment chunks.

---

### FRD 4: PR-Edit System (Section-Scoped)

**PRD Sections:** 6.3, 6.4, 7, 8, 9

**Scope:** See [FRD-4-pr-edit-system.md](./FRDs/FRD-4-pr-edit-system.md)

**Exit criteria:** Contributors can propose edits to one or more sections with rationale; AI pre-screen verdict is visible to contributor and reviewers; reviewer performs accept / reject / request-changes decision; contributor can respond to a `changes_requested` proposal with a new patchset; affiliated reviewers cannot make any decision on own-org proposals (detail is read-only); stale proposals require rebase patchset; accepted proposals create new page versions and trigger FRD 1/3 downstream updates.

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
- **Reviewer queue** (`/admin/reviews`) — paginated list of pending edit proposals with per-section diff cards, AI pre-screen verdict, accept / reject / request-changes actions, COI enforcement
- **Page claim approval queue** (`/admin/claims`) — review org claim requests, approve or reject with required reason
- **Cold-start job history** (`/admin/cold-start/jobs`) — view and re-run failed jobs
- **Lifecycle config editor** (`/admin/lifecycle`) — edit per-category staleness thresholds
- **User management** (`/admin/users`) — role picker, affiliations drawer for COI tracking
- **Comment moderation** (`/admin/reports`) — hide reported comments (hide-only; no deletion)
- **Audit log** (`/admin/activity`) — append-only log of every admin mutation

**New schema:** `admin_activity_log`, `proposal_review_comments`, `edit_proposals.status` extended with `changes_requested`, `claim_requests.decision_reason`, `cold_start_jobs.supersedes_job_id`.

**Exit criteria:** All seven admin surfaces render behind appropriate guards; reviewer can accept, reject, and request changes on PRs end-to-end; COI check blocks affiliated reviewers from all decision actions; cold-start re-run creates a new job with `supersedes_job_id` set; lifecycle config saves and is respected by page renders; role + affiliation changes persist; reported comments can be hidden; every admin mutation writes to `admin_activity_log`.

---

### FRD 8: Bookmarks and Contribution History

**PRD Section:** 9

**Scope:** See [FRD-8-bookmarks.md](./FRDs/FRD-8-bookmarks.md)

**Depends on:** FRD 0, FRD 2, FRD 4, FRD 6

**Note:** FRD 6 delivers `/my/bookmarks` and `/my/contributions` as "Coming Soon" stubs and defines the `bookmark.toggle` pending action. This FRD implements the backing feature.

**Delivers:** Bookmark toggle button in wiki page header; `POST /api/bookmarks/toggle` route handler (also consumed by FRD 6's pending-action replay); `/my/bookmarks` page listing saved pages; `/my/contributions` page listing the authenticated user's edit proposals with full status display (`pending`, `changes_requested`, `needs_rebase`, `accepted`, `rejected`, `withdrawn`, `superseded`).

**Exit criteria:** Bookmark button appears on wiki pages for authenticated users; toggle saves / removes from `bookmarks` table; `/my/bookmarks` lists all saved pages with org name, category, and last-edited date; `/my/contributions` lists all user PRs with section names, status badge, and link to the proposal; unauthenticated users are redirected to sign-in with returnTo.

---

## Dependency Graph

```
FRD 0 (Setup)
├── FRD 1 (RAG Pipeline)
├── FRD 2 (Wiki Pages, Directory, Editor, Core Page UX) [note: External Links section spec is included here]
│   └── FRD 3 (Comments System)
│       └── FRD 4 (PR-Edit System) ← canonical source of truth for all proposal/reviewer behavior
├── FRD 5 (Cold Start Agent) [depends on FRD 0 + FRD 2]
├── FRD 6 (Auth UI) [depends on FRD 0; unblocks write paths in FRDs 2, 3, 4, 5]
│   └── FRD 7 (Admin Dashboard & Moderation) [depends on FRD 0, 2, 3, 4, 5, 6]
│       └── FRD 8 (Bookmarks & Contribution History) [depends on FRD 0, 2, 4, 6]
```

> **Note on External Links (formerly FRD 10):** The External Links section (PRD Appendix B) is specified directly within FRD 2. No separate FRD is needed — the `external_links` table schema is already in FRD 0 and the rendering logic belongs to the wiki page UX.

---

## Implementation Guidance

This section captures conventions, supersession rules, and known gaps that every implementer should read before starting any FRD.

### How to Read an FRD

Each FRD header table contains:

| Field | Meaning |
|-------|---------|
| **Depends On** | All prior FRDs must be fully implemented before starting this one |
| **Delivers** | The authoritative list of what this FRD produces |
| **Supersession and Overlap Resolution** | Section in the FRD body that explicitly states what prior FRD sections it replaces |

When two FRDs describe the same surface (e.g., the reviewer dashboard appears in both FRD 2 and FRD 4), the **later FRD is always authoritative**. The earlier FRD's version serves as scaffolding only. Check the "Supersession and Overlap Resolution" section of the later FRD for the precise list.

### Supersession Index

| What was defined | Where | Superseded by | Notes |
|-----------------|-------|---------------|-------|
| PR submission UI, diff generation, reviewer dashboard, `/admin/proposals` route | FRD 2 §§5–8, §13 | FRD 4 | FRD 4 is the canonical PR/reviewer implementation. FRD 2's reviewer stubs serve as scaffolding only. |
| `/api/admin/reports/[id]/resolve` (described as "delete comment") | FRD 3 §15, exit criterion 23 | FRD 7 | Replaced by `/api/admin/comments/[id]/hide` (hide-only) and `/api/admin/reports/[id]/dismiss`. |
| Reviewer accept/reject only (two-state decisions) | FRD 4 (pre-amendment) | FRD 7 + FRD 4 (amended) | FRD 7 introduces `changes_requested` as a third non-terminal decision state. FRD 4 must be amended to include it. |

### FRD 7 Amendment Tracker

FRD 7 introduces schema and behavioral changes that require amendments to four prior FRDs. These amendments must be applied before implementation of FRD 7 can begin. Track their status here:

| Amendment | Target FRD | Section(s) | Status |
|-----------|-----------|------------|--------|
| Add `'changes_requested'` to `edit_proposals.status` CHECK constraint | FRD 4 | §3 (Data Model), Appendix A (State Machine) | ✅ Applied |
| Add new subsection 7.3 "Request Changes Pipeline" | FRD 4 | §7 | ✅ Applied |
| Extend COI language to cover all three decision actions | FRD 4 | §6.3 | ✅ Applied |
| Add `POST /api/proposals/[id]/request-changes` to API contracts table | FRD 4 | §8 | ✅ Applied |
| Update exit criteria 20 (remove premature audit-log criterion; add `changes_requested` criteria) | FRD 4 | §11 | ✅ Applied |
| Add `decision_reason TEXT` to `claim_requests` table | FRD 2 | §12.2 | ✅ Applied |
| Update `POST /api/claims/[id]/reject` to accept `decision_reason` | FRD 2 | §13 | ✅ Applied |
| Replace `/resolve` with `/hide` and `/dismiss` endpoints | FRD 3 | §15 | ✅ Applied |
| Update exit criterion 23 from "delete" to "hide" | FRD 3 | §16 | ✅ Applied |
| Add `supersedes_job_id` column to `cold_start_jobs` | FRD 5 | §12.1 | ✅ Applied |
| Add `POST /api/admin/cold-start/jobs/[id]/rerun` to API routes | FRD 5 | §13 | ✅ Applied |

### Schema-Only Features (No UI FRD Yet)

The following tables exist in the FRD 0 database schema but have no FRD covering their UI or delivery logic. They are not bugs — they are intentionally deferred. Do not implement UI for them without a future FRD.

| Table | Planned for | Notes |
|-------|------------|-------|
| `notifications` | Post-MVP | Schema exists (FRD 0). No delivery FRD. FRD 3 explicitly defers in-app notifications to Post-MVP. When a Notifications FRD is written, it will layer on top of the existing table. |

### Route Conventions

All admin API mutations follow this pattern:

- **Route handler location:** `src/app/api/[resource]/[id]/[action]/route.ts`
- **Admin surfaces** (proposal decisions, claim decisions, hide/dismiss comments, lifecycle config): mounted at `/api/[resource]/...` with server-side role guards — **not** under an `/api/admin/` prefix unless the resource is purely admin-internal (e.g., `/api/admin/cold-start/jobs/[id]/rerun`, `/api/admin/users/[id]/role`)
- **Proposal decisions** (accept, reject, request-changes): `/api/proposals/[id]/accept|reject|request-changes` — no `admin` prefix, consistent with FRD 4's established pattern
- **Response shape:** always `ActionResult<T>` — `{ ok: true, data: T } | { ok: false, error: string, code: AdminErrorCode }` per FRD 6/7

### Org Categories (Canonical List)

The six org categories used throughout the codebase are:

```ts
export const ORG_CATEGORIES = [
  "Design Teams",
  "Engineering Clubs",
  "Non-Engineering Clubs",
  "Academic Programs",
  "Student Societies",
  "Campus Organizations",
] as const;
```

This matches PRD Appendix A, FRD 2, and FRD 7. **FRD 5 had an outdated list** (Competition Teams, Student Government, etc.) which has been corrected in FRD 5 as part of the review pass.
