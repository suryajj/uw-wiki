# UW Wiki -- Feature Requirements Document Order

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                            |
| **Parent Document** | [PRD v0.1](./PRD.md)                                               |
| **Created**         | 2026-04-05                                                         |
| **Purpose**         | Define the ordered sequence of FRDs for incremental implementation |

---

## Pre-Implementation Requirement

**Read [`CONSTRAINTS.md`](./CONSTRAINTS.md) before implementing any FRD.** It documents framework version-specific gotchas (Tailwind v4 CSS-first config, AI SDK v5 import paths, migration file numbering, complete env var list) that are not obvious from the FRDs themselves and will cause silent runtime failures if missed.

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
| 4   | [PR-Edit System (Section-Scoped)](./FRDs/FRD-4-pr-edit-system.md)             | 6.3, 6.4, 7, 8, 9           | FRD 0, FRD 1, FRD 2, FRD 3 | Section-scoped edit proposals (single or multi-section), contributor rationale, reviewer accept / reject / request-changes decisions, `changes_requested` workflow, conflict-of-interest enforcement, patchset/rebase workflow |
| 5   | [Cold Start Agent](./FRDs/FRD-5-cold-start-agent.md)                          | 6.8, 6.6, 13                | FRD 0, FRD 2               | Admin-triggered agent: org identification (name or URL), Tavily web research, ProseMirror JSON synthesis, Pulse seeding, draft preview and publish flow                                                                           |
| 6   | [Auth UI and Pending Action Preservation](./FRDs/FRD-6-auth-ui.md)            | 9, 12                       | FRD 0                      | `/auth/sign-in` page, AuthModal component, signup with magic-link verification, passwordless magic-link sign-in, password reset, Google OAuth, sign-out, header user state, pending-action localStorage (24h TTL) with auto-resume, `returnTo` routing, guard redirects, `/my/*` stubs |
| 7   | [Admin Dashboard and Moderation](./FRDs/FRD-7-admin-dashboard.md)             | 6.7, 6.8, 7, 8              | FRD 0, FRD 2, FRD 3, FRD 4, FRD 5, FRD 6 | Reviewer PR queue (accept / reject / request-changes), page claim approval, cold-start job history + re-run, lifecycle config editor, user role + affiliation management, comment moderation (hide-only), `admin_activity_log` audit trail. **Requires amendments to FRD 2, 3, 4, 5 — see Amendment Tracker below.** |
| 8   | [Bookmarks and Contribution History](./FRDs/FRD-8-bookmarks.md)               | 9                           | FRD 0, FRD 2, FRD 4, FRD 6 | Bookmark toggle (wiki page header + route handler), `/my/bookmarks` page, `/my/contributions` PR history page with all status states                                                                                             |
| 9   | [Notifications](./FRDs/FRD-9-notifications.md)                                | §13 (moved from Post-MVP)   | FRD 0, FRD 3, FRD 4, FRD 6, FRD 8 | In-app bell icon + unread badge, `/my/notifications` page, email delivery via Resend/Supabase SMTP, `notification_preferences` schema with per-channel opt-out, PR status / comment reply / page-update digest notifications |

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

**Exit criteria:** Directory renders with grid/list toggle and category sections; wiki pages render in three-column layout (TOC, content, Pulse sidebar); Tiptap inline editor base works with image upload and autosave; lifecycle banners; External Links section included in template; Official section rendered from inline `attrs.official: true`; version history shell.

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

**Exit criteria:** Contributors can propose edits to one or more sections with rationale (anonymous or attributed); anonymous submit nudge modal shown; reviewer performs accept / reject / request-changes decision; affiliated reviewers see COI disclosure banner but all actions remain enabled; contributor can respond to a `changes_requested` proposal with a new patchset; stale proposals require rebase patchset; accepted proposals create new page versions and trigger FRD 1/3 downstream updates.

---

### FRD 5: Cold Start Agent

**PRD Sections:** 6.8, 6.6, 13

**Scope:** See [FRD-5-cold-start-agent.md](./FRDs/FRD-5-cold-start-agent.md)

**Exit criteria:** Admin can identify a UW org by name or URL via smart input; confirmation card is editable; research runs with step-by-step progress tracking; synthesis produces valid ProseMirror JSON; Selectivity and Tech Stack are seeded from research (Vibe Check/Co-op Boost left empty); draft preview renders correctly; publish creates org + page + page_version + Pulse seed ratings for Selectivity/Tech Stack only; published page displays with AI-generated banner; non-admin access is blocked; rate limiting prevents runaway costs.

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
- **Reviewer queue** (`/admin/reviews`) — paginated list of pending edit proposals with per-section diff cards, accept / reject / request-changes actions, COI disclosure banner
- **Official Section seeder** (`/admin/official-sections`) — admin tool to seed Official content directly on an org's wiki page
- **Cold-start job history** (`/admin/cold-start/jobs`) — view and re-run failed jobs
- **Lifecycle config editor** (`/admin/lifecycle`) — edit per-category staleness thresholds
- **User management** (`/admin/users`) — role picker, affiliations drawer with admin revoke capability
- **Comment moderation** (`/admin/reports`) — hide/unhide reported comments (hide-only; no deletion)
- **Audit log** (`/admin/activity`) — append-only log of every admin mutation

**New schema:** `admin_activity_log`, `proposal_review_comments`, `edit_proposals.status` extended with `changes_requested`, `cold_start_jobs.supersedes_job_id`.

**Exit criteria:** All seven admin surfaces render behind appropriate guards; reviewer can accept, reject, and request changes on PRs end-to-end; affiliated reviewers see COI disclosure banner (all actions enabled); Official Section seeder creates `page_versions` row with `is_admin_seeded: true`; cold-start re-run creates a new job with `supersedes_job_id` set; lifecycle config saves and is respected by page renders; role + affiliation changes persist; reported comments can be hidden/unhidden; every admin mutation writes to `admin_activity_log`.

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
├── FRD 2 (Wiki Pages, Directory, Editor, Core Page UX) [includes External Links section template]
│   └── FRD 3 (Comments System)
│       └── FRD 4 (PR-Edit System) ← canonical source of truth for all proposal/reviewer behavior
├── FRD 5 (Cold Start Agent) [depends on FRD 0 + FRD 2]
├── FRD 6 (Auth UI) [depends on FRD 0; unblocks write paths in FRDs 2, 3, 4, 5]
│   └── FRD 7 (Admin Dashboard & Moderation) [depends on FRD 0, 2, 3, 4, 5, 6]
│       └── FRD 8 (Bookmarks & Contribution History) [depends on FRD 0, 2, 4, 6]
│           └── FRD 9 (Notifications) [depends on FRD 0, 3, 4, 6, 8]
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
| PR submission UI, diff generation, reviewer dashboard, `/admin/proposals` route | FRD 2 §§5–7, §12 | FRD 4 | FRD 4 is the canonical PR/reviewer implementation. FRD 2 §§5–7 are now stub-replaced with "Superseded by FRD 4" notes. Original section numbers corrected during FRD-4 reconciliation pass. |
| `organizations.official_content_json` (separate column for Official content) | FRD 2 §10.3, §11.1 | FRD 2 (updated) + FRD 4 | Official content is now stored inline in `pages.content_json` as an H2 node with `attrs.official: true`. Separate column dropped. |
| `/api/admin/reports/[id]/resolve` (described as "delete comment") | FRD 3 §15, exit criterion 23 | FRD 7 | Replaced by `/api/admin/comments/[id]/hide` (hide-only) and `/api/admin/reports/[id]/dismiss`. |
| Reviewer accept/reject only (two-state decisions) | FRD 4 (pre-amendment) | FRD 7 + FRD 4 (amended) | FRD 7 introduces `changes_requested` as a third non-terminal decision state. FRD 4 must be amended to include it. |
| `superseded` proposal status (terminal) | FRD 4, FRD 7, FRD 8 | FRD 4 reconciliation pass | Collapsed into `needs_rebase` (recoverable). Competing proposals on accepted sections are now marked `needs_rebase` instead of terminal `superseded`. All three FRDs updated. |
| Page claim flow (`/admin/claims`, `claim_requests` table, `organizations.claimed_by/claimed_at`, `POST /api/claims/*`) | FRD 2 §§10–12, FRD 7 §4 | Round 2 Reconciliation | Replaced entirely by self-declared affiliation model. Users declare affiliations at `/my/profile` (FRD-6). Admins revoke via FRD-7 §7. Official sections seeded by affiliated PR or admin tool (FRD-7 §4). |
| `notifications` as Schema-Only / Post-MVP | FRD-order.md Schema-Only table, FRD-3 "no notifications" note | Round 2 Reconciliation → FRD 9 | Notifications moved to MVP. FRD 9 covers full delivery. |

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

### FRD 4 Reconciliation Pass Amendment Tracker

Applied during the May 2026 cross-FRD reconciliation pass. All amendments below are ✅ Applied.

| Amendment | Target FRD(s) | Section(s) | Status |
|-----------|--------------|------------|--------|
| Drop `superseded` status; expand `needs_rebase` to cover competing-accept cases | FRD 4, FRD 7, FRD 8 | FRD 4 §§2.1, 2.4, 6.1, 7.4, Appendix A, C; FRD 7 §§3.1, 2.6, Appendix B; FRD 8 §2, §3.2 | ✅ Applied |
| Inline Official content: drop `organizations.official_content_json`; add `official: true` H2 attr in `pages.content_json`; update claim-approval insert flow | FRD 2, FRD 4 | FRD 2 §§10.2–10.4, §11.1, §2.5, Appendix A; FRD 4 §§1.6, 6.1, 8.3 | ✅ Applied |
| Add `Underline` and `Highlight` Tiptap extensions to match FRD-4 §8.3 allowlist | FRD 2 | §4.2, Appendix A | ✅ Applied |
| Stub-replace FRD-2 §§5–7 (PR submission, diff gen, reviewer dashboard) with "Superseded by FRD 4" notices; fix §12 API table | FRD 2 | §§5–7, §12 | ✅ Applied |
| Correct FRD-4 supersession block section numbers (§7→§6, §13→§12, §8.4-8.6→§7) | FRD 4 | Supersession block | ✅ Applied |
| Drop vestigial fields: `proposal_scope`, `aiVerdict`, `aiReason`, `decision source ('manual')` | FRD 4 | §§3.1, 5.5, 7.4, Appendix B, C | ✅ Applied |
| Fix FRD-4 internal: auth contradiction (§1.5, §7.1 now say anonymous allowed); status list (add `changes_requested`, drop `superseded`); lifecycle rule numbering; `is_current` flip constraint; mergeability timing (§4.6); slug stability (§4.7); post-commit function names | FRD 4 | §§1.5, 2.1, 2.3, 3.3, 4.6, 4.7, 5.2, 6.1, 7.1, Gherkin | ✅ Applied |
| Fix FRD-7 precondition: remove `proposed_content_json` reference; update status enum listing | FRD 7 | Given Context | ✅ Applied |

### FRD 9: Notifications

**PRD Section:** §13 (moved from Post-MVP to MVP)

**Scope:** See [FRD-9-notifications.md](./FRDs/FRD-9-notifications.md)

**Depends on:** FRD 0, FRD 3, FRD 4, FRD 6, FRD 8

**Delivers:** In-app notification bell with unread count, `/my/notifications` full history page, email delivery via Resend/Supabase SMTP, `notification_preferences` table with per-channel opt-out, PR status notifications (accepted/rejected/changes-requested/needs-rebase), comment reply notifications, bookmarked-page update digest.

**Exit criteria:** Bell shows correct unread count; clicking navigates to relevant resource; preferences are honored; email is sent/withheld based on preferences; anonymous PR contributors receive no notifications; digest job delivers weekly summaries for bookmarked pages.

---

### Round 2 Reconciliation Amendment Tracker

Applied during the May 2026 Round 2 cross-FRD reconciliation pass. All amendments below are ✅ Applied.

| Amendment | Target FRD(s) | Section(s) | Status |
|-----------|--------------|------------|--------|
| Drop claim flow; replace with self-declared affiliation model | FRD 2, FRD 7 | FRD 2 §§10–12; FRD 7 §§4, 7, 9.2, 1.1, Gherkin | ✅ Applied |
| Add `is_from_affiliated_contributor` to `edit_proposals`; add `is_admin_seeded` to `page_versions` | FRD 2, FRD 4 | FRD 2 §11.1; FRD 4 §1.6, §3.1 | ✅ Applied |
| Official Section seeder admin tool | FRD 7 | New §4 (replacing claim approval queue) | ✅ Applied |
| Switch COI from blocking to disclosure-only (yellow banner; all actions enabled; affiliation captured in audit log) | FRD 4, FRD 7 | FRD 4 §§5.3, 5.4, Gherkin; FRD 7 §§2.6, 2.8, 3.3, exit criteria 13 | ✅ Applied |
| Exclude hidden comments from AI search: chunk deletion on hide, re-embed on unhide, defense-in-depth retrieval filter | FRD 1, FRD 3, FRD 7 | FRD 1 §§3.3, 4.1, 4.2, 4.3; FRD 3 §§13.5, 14.1; FRD 7 §8.4 | ✅ Applied |
| Promote External Links to a page section (add to template, drop FRD-1 skip rule) | FRD 2, FRD 1 | FRD 2 §4.5 template; FRD 1 §3.3 trigger, §4.1 design decision | ✅ Applied |
| Add anonymous PR sign-in nudge modal before submit | FRD 4 | §1.4 | ✅ Applied |
| Student Societies lifecycle threshold: Needs Update 6 → 12 months | FRD 2 | §9.2 | ✅ Applied |
| Fix `pulse/vote` API auth: None → Required | FRD 2 | §12 API table | ✅ Applied |
| Create FRD-9 Notifications (full MVP: in-app + email + preferences) | FRD 9 (new) | All sections | ✅ Applied |
| Wire FRD-9 notification triggers into PR pipelines | FRD 4 | §6.1 post-commit jobs | ✅ Applied |
| Wire FRD-9 comment reply notification | FRD 3 | §6 reply flow | ✅ Applied |
| Wire FRD-9 page update digest into bookmarks | FRD 8 | §8 (reference added) | ✅ Applied |
| Drop `is_hidden` from `chunk_type` CHECK; add to comments ALTER | FRD 1, FRD 3 | FRD 1 schema; FRD 3 §14.1 | ✅ Applied |
| Affiliation profile management section | FRD 6 | §affiliation management | ✅ Applied (FRD 6 cleanup) |
| Drop `pages.title` reference from bookmarks display | FRD 8 | §4 | ✅ Applied |

### Schema-Only Features (No UI FRD Yet)

The following tables exist in the FRD 0 database schema but have no FRD covering their UI or delivery logic. They are not bugs — they are intentionally deferred. Do not implement UI for them without a future FRD.

| Table | Planned for | Notes |
|-------|------------|-------|
| *(none at this time)* | — | All deferred tables from prior rounds have been addressed. `notifications` is now covered by FRD 9. |

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

### Rate Limiting Reference

All write endpoints use **Upstash** (`@upstash/ratelimit` + `@upstash/redis`) via the shared helper at `src/lib/rate-limit.ts`. The package and env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are established in FRD 5.

Key strategy: **authenticated users** are keyed on `user_id`; **unauthenticated users** fall back to client IP. Auth requirement varies by endpoint — see the table below. All limits return `429` with a `Retry-After` header on breach.

| Endpoint | FRD | Auth required? | Auth key | Unauth key | Auth limit | Unauth limit | Window |
|----------|-----|----------------|----------|------------|------------|--------------|--------|
| `POST /api/search` (RAG) | FRD 1 §12 | No | `user_id` | IP | 30/min | 10/min | Sliding |
| `POST /api/pulse/vote` | FRD 2 §3.4 | **Yes** | `user_id` | n/a | 30 votes / 10 min | n/a | Sliding |
| `POST /api/comments` | FRD 3 §12.4 | No | `user_id` | IP | 1/5s burst + 50/24h | 1/10s burst + 20/24h | Sliding + Fixed |
| `POST /api/comments/[id]/replies` | FRD 3 §12.4 | No | `user_id` | IP | same as comments | same | Sliding + Fixed |
| `POST /api/proposals` | FRD 4 §9.2 | No | `user_id` | IP | 5/hour | 3/hour | Sliding |
| `POST /api/proposals/[id]/patchsets` | FRD 4 §9.2 | **Yes** (owner) | `user_id:proposalId` | n/a | 3/10 min | n/a | Sliding |
| `POST /api/admin/cold-start/jobs` | FRD 5 §12 | **Yes** (admin) | `user_id` | n/a | Per FRD 5 spec | n/a | Fixed |

**Implementation note:** check the rate limit at the **top** of the route handler, before any DB reads or AI calls, so a limited request pays zero additional cost.
