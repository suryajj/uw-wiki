# UW Wiki — Handoff State

Single source of truth for everything that lives **outside** the codebase: dashboard configurations, external accounts, manual SQL runs, schema state on cloud DBs, and gotchas not visible from reading code.

> Always update this file when external state changes. See `.cursor/rules/handoff-doc.mdc` for the rule that governs this. Most recent entries at the top within each section.

---

## External Services — Setup State

| Service | Account | Status | Notes |
|---|---|---|---|
| **Supabase** | `uwwikiadmin@gmail.com` | Active, Free tier | Project ref `tnjudidyeqifcruudige`, URL `https://tnjudidyeqifcruudige.supabase.co` |
| **OpenRouter** | (Google sign-in) | Active, low credits | FRD-1 embeddings and capped `/api/search` responses are working. Keep `maxOutputTokens` capped and add/monitor credits before heavier AI testing. |
| **Upstash Redis** | (Google sign-in) | Active, Free tier | DB: `mature-anteater-116402`, region default. 10K req/day cap. |
| **Tavily** | (Google sign-in) | Active, dev key | Free tier; cap configured in FRD-5 to 20 calls per cold-start run. |
| **Resend** | (Google sign-in) | Active, **no domain verified** | API key works for `onboarding@resend.dev` sender only. For real email (FRD-9), verify a domain before launch. |
| **Google Cloud Console / OAuth** | (not set up yet) | **Not configured** | FRD-6 task: create OAuth 2.0 client, add Supabase callback URL, paste Client ID/Secret into Supabase Auth → Providers → Google. |
| **Vercel** | (not set up yet) | **Not configured** | Deploy when MVP is buildable end-to-end. Will need to paste every `.env.local` var into Project Settings → Environment Variables. |
| **PostHog** | (not set up) | Optional | Skipped for MVP. |

---

## Supabase Dashboard — Actions Taken

### 2026-05-08 (audit hardening pass)
- **`0042_security_hardening.sql` applied** via `npx supabase db query --linked --file ...`. Effects:
  - Revoked `EXECUTE` on `accept_proposal_commit(...)` and `increment_comment_vote(...)` from `PUBLIC`/`anon`/`authenticated`; only `service_role` can call them now.
  - Tightened anonymous RLS: `comments`, `edit_proposals`, and `comment_reports` inserts now require `auth.uid() IS NOT NULL`. Anonymous writes still work because all API routes go through the service role; a leaked anon JWT can no longer post directly to PostgREST.
  - Dropped the dead `is_anonymous_report()` helper.
  - Added `comments.is_anchored boolean` (default `true`) so the API can persist re-anchor results, and `edit_proposals.last_decision_log jsonb` so reviewer-affiliation snapshots can be captured per FRD-4 §5.4 until FRD-7 ships `admin_activity_log`.

### 2026-05-08
- **FRD-2/3/4 migrations:** `002_wiki_pages.sql`, `003_comments.sql`, `004_pr_edit_system.sql`, and `0041_seed_extend.sql` were applied directly with `npx supabase db query --linked --file ...` because `supabase db push` is still blocked by migration-history drift.
- **Schema now includes:** `pages.slug`, `page_versions.version_number`, lifecycle `stale_days`/`defunct_days`, `comment_votes.vote_type`, `edit_proposal_patchsets`, and FRD-4 mergeability/base-version fields on `edit_proposals`.
- **Seed state updated:** WATonomous now has a richer multi-section page and current `page_versions` row; Midnight Sun was added as a second directory org for browse/filter testing.

### 2026-05-07
- **Supabase CLI:** `npx supabase db push` was attempted after linking but blocked by migration-history drift because `001_init_foundation.sql` had already been applied manually in SQL Editor. `supabase migration repair --status applied 001` was run, but the CLI still reports history mismatch for the non-timestamp `001` migration. For FRD-1, the RPC SQL was applied directly with `npx supabase db query --linked --file supabase/migrations/0011_rag_search_functions.sql`.
- **Supabase RPCs:** `match_chunks_semantic` and `match_chunks_keyword` are now installed. The migration needed `extensions.vector(512)` and `set search_path = public, extensions` because pgvector lives in Supabase's `extensions` schema.
- **Database → Extensions:** `vector` enabled (pgvector). Required for FRD-1 RAG embeddings.
- **SQL Editor:** ran `supabase/migrations/001_init_foundation.sql` — all 18 baseline tables created, RLS policies applied, user-sync trigger on `auth.users` installed.
- **SQL Editor:** ran `supabase/seed.sql` — seeded 1 university (Waterloo), 6 lifecycle thresholds, 1 sample org (WATonomous) with 1 page and 4 Pulse aggregates.
- **Auth → Providers → Email:** confirmed enabled with "Confirm email" turned on.
- **API Keys page:** generated new-format keys (`sb_publishable_…` and `sb_secret_…`); legacy JWT `anon`/`service_role` keys still active as fallback.

---

## Things Set Up That Don't Need Code Action

- **Supabase user-sync trigger** is now in the cloud DB: any new `auth.users` row auto-creates a matching `public.users` row with `role='user'`. App code can rely on this without doing manual user inserts.
- **Public-read RLS** is on for directory/page content tables. Anonymous browsing works without any auth header.
- **Two key formats coexist:** `.env.local` uses the new `sb_publishable_…` and `sb_secret_…` keys; the legacy JWT `anon` is also stored as `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a defensive fallback. Don't disable legacy keys in the dashboard until we've verified end-to-end auth (post-FRD-6).

---

## Caveats and Gotchas Not Visible in Code

| # | Item | Action needed |
|---|---|---|
| 1 | **OpenRouter credits are limited.** | FRD-1 works with capped responses (`maxOutputTokens: 1200`), but heavier prompts or default large output budgets can still fail. Add/monitor credits before heavier AI testing. |
| 2 | **Resend has no verified domain.** | Before FRD-9 launches, verify the sending domain (e.g. `uw-wiki.ca`) and update `EMAIL_FROM`. Until then, only `onboarding@resend.dev` will deliver. |
| 3 | **Google OAuth not wired.** | FRD-6 will need a Google Cloud project + OAuth 2.0 client. Steps documented in the prior chat summary; not done yet. |
| 4 | **Migration ordering bug fixed.** | `001_init_foundation.sql` originally declared `is_anonymous_report()` *after* a policy that referenced it — Postgres rejects this. Fixed in commit before first apply. |
| 5 | **`organizations.claimed_status` is dead-weight.** | The Round 2 reconciliation dropped the page-claim flow. App code ignores this column; it can be dropped in a later cleanup migration after no seed scripts reference it. |
| 6 | **Reviewer-auth live browser flow not fully exercised.** | FRD-4 reviewer APIs compile, build, and now expose inline accept/reject/request-changes UI at `/admin/reviews/[id]`. Live exercise still requires a reviewer-role session — seed a reviewer user via Supabase Auth or wait for FRD-6 sign-in. |
| 6b | **Markdown sanitizer downgrade.** | `isomorphic-dompurify` was removed in the FRD-2/3/4 round because its CSS calc dependency broke Next.js dev SSR. `renderCommentMarkdown` now relies on `escapeHtml` + a regex pipeline that only emits `<strong>/<em>/<a>/<br>`, with link `href` restricted to `^https?://`. Re-add a sanitizer (or migrate to a JSX-tree renderer) before launch if FRD-3 §16.1 wording is binding. |
| 7 | **Node.js 20 + Supabase JS in standalone scripts.** | The realtime client needs `ws` on Node < 22. Standalone scripts in `scripts/` should use raw `fetch` against PostgREST instead of `createClient` (see `scripts/smoke-test-supabase.mjs`). Next.js itself is fine — Node ≥ 22 isn't required. |
| 8 | **Docker not used.** | Deployment is Vercel + managed Supabase. The optional "Local-full mode" Docker setup in FRD-0 §3 is intentionally skipped. |
| 9 | **FRD-1 needs RPC SQL despite `chunks` existing.** | Supabase JS cannot directly express `embedding <=> query_vector`, so FRD-1 adds `0011_rag_search_functions.sql` for semantic and keyword search RPCs. This has been applied via `supabase db query --linked --file ...`, not `db push`, because migration history is drifted from the manual FRD-0 apply. |
| 10 | **OpenRouter chat route must use chat completions.** | `@ai-sdk/openai` v2 defaults `openrouter(model)` to the Responses API, which failed after tool outputs through OpenRouter. `/api/search` must use `openrouter.chat("google/gemini-2.5-flash")`. |

---

## Smoke Tests Run

| When | Test | Result |
|---|---|---|
| 2026-05-07 | `node scripts/smoke-test-supabase.mjs` (cloud) | 18/18 baseline tables present, seed data present |
| 2026-05-07 | `npm run typecheck` | clean |
| 2026-05-07 | `npm run lint` | no warnings |
| 2026-05-07 | `npm run build` | 12/12 routes generated |
| 2026-05-07 | `npm run dev` + `GET /api/health` | 200 OK |
| 2026-05-07 | `npm run dev` + `GET /` (middleware → Supabase auth refresh) | 200 OK, no errors |
| 2026-05-07 | `GET /search` | 200 OK |
| 2026-05-07 | `node scripts/smoke-test-tools.mjs` | WATonomous Pulse data, page health, and coop_boost ranking returned |
| 2026-05-07 | `node scripts/smoke-test-embeddings.mjs` | OpenRouter embedding returned 10 ordered vectors with 512 dimensions each |
| 2026-05-07 | `node scripts/smoke-ingest-seed-page.mjs` | Inserted 1 WATonomous content chunk into `chunks` |
| 2026-05-07 | `node scripts/smoke-test-rag.mjs` | Passed after `0011_rag_search_functions.sql`; semantic=1, keyword=1 for `ROS2 WATonomous` |
| 2026-05-07 | hidden-comment RPC filter smoke | Temporary hidden comment chunk was excluded by both keyword and semantic RPCs, then cleaned up |
| 2026-05-07 | Upstash rate-limit smoke | Test limiter allowed first 2 requests and denied the 3rd |
| 2026-05-07 | `npx supabase db push` | Blocked by migration-history drift after manual FRD-0 SQL apply; used `db query --linked --file` for FRD-1 SQL instead |
| 2026-05-07 | `POST /api/search` with `What is WATonomous like?` | Passed: streamed, called `search_wiki` + `get_org_data`, returned cited text and `/wiki/watonomous#overview` source |
| 2026-05-07 | `POST /api/search` with off-topic weather query | Passed: did not call tools; redirected to UW Wiki scope |
| 2026-05-08 | `npm run typecheck` | clean after FRD-2/3/4 |
| 2026-05-08 | `npm run lint` | no warnings |
| 2026-05-08 | `npm run build` | 16/16 routes generated, including wiki/history/comments/proposals/admin review routes |
| 2026-05-08 | `node scripts/smoke-test-frd234.mjs` | FRD-2/3/4 schema and seed checks passed |
| 2026-05-08 | `GET /`, `/wiki/watonomous`, `/wiki/watonomous/history` | 200 OK |
| 2026-05-08 | `POST /api/pulse/vote` unsigned | 401 as expected |
| 2026-05-08 | `GET /api/comments` + unsigned `POST /api/comments` | Passed; comment row and RAG chunk were created, then smoke data cleaned up |
| 2026-05-08 | unsigned `POST /api/proposals` | Passed; proposal and patchset rows were created, then smoke data cleaned up |
| 2026-05-08 (audit) | `node scripts/smoke-test-audit-fixes.mjs` | Passed: schema columns, anonymous insert RLS, RPC revokes, hidden-comment RAG filter all verified |
| 2026-05-08 (audit) | `npm run typecheck`, `npm run lint`, `npm run build` | All clean; build emits 15/15 routes including new audit fixes |
| 2026-05-08 (audit) | live `POST /api/proposals` with `attrs.official: true` | Returns 422 INVALID_CONTENT — contributor cannot toggle official |
| 2026-05-08 (audit) | live `POST /api/comments` anonymous + valid `POST /api/proposals` | Both 201; smoke data cleaned up |

---

## What's Still Owed Before Production

- Add/monitor OpenRouter credits before heavier RAG testing; current balance can run capped MVP responses (`maxOutputTokens: 1200`) but rejected the default 65k output budget.
- Verify a Resend sending domain (FRD-9).
- Configure Google OAuth in Google Cloud + Supabase Auth (FRD-6).
- Create or sign in with a reviewer/admin account before live-testing FRD-4 accept/reject/request-changes through authenticated endpoints.
- Resolve Supabase migration-history drift before relying on `npx supabase db push` for future migrations. Current workaround: apply single SQL files with `npx supabase db query --linked --file ...`.
- Create a Vercel project, paste env vars, link to GitHub repo.
- Decide on a production sender domain for `EMAIL_FROM`.
- Disable legacy Supabase JWT keys after end-to-end auth confirmed.
