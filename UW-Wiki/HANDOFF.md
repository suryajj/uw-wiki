# UW Wiki — Handoff State

Single source of truth for everything that lives **outside** the codebase: dashboard configurations, external accounts, manual SQL runs, schema state on cloud DBs, and gotchas not visible from reading code.

> Always update this file when external state changes. See `.cursor/rules/handoff-doc.mdc` for the rule that governs this. Most recent entries at the top within each section.

---

## External Services — Setup State

| Service | Account | Status | Notes |
|---|---|---|---|
| **Supabase** | `uwwikiadmin@gmail.com` | Active, Free tier | Project ref `tnjudidyeqifcruudige`, URL `https://tnjudidyeqifcruudige.supabase.co` |
| **OpenRouter** | (Google sign-in) | Active, **0 credits** | Need to add credits before any LLM call (FRD-1, FRD-5) will succeed. Until then, AI routes will return a billing error. |
| **Upstash Redis** | (Google sign-in) | Active, Free tier | DB: `mature-anteater-116402`, region default. 10K req/day cap. |
| **Tavily** | (Google sign-in) | Active, dev key | Free tier; cap configured in FRD-5 to 20 calls per cold-start run. |
| **Resend** | (Google sign-in) | Active, **no domain verified** | API key works for `onboarding@resend.dev` sender only. For real email (FRD-9), verify a domain before launch. |
| **Google Cloud Console / OAuth** | (not set up yet) | **Not configured** | FRD-6 task: create OAuth 2.0 client, add Supabase callback URL, paste Client ID/Secret into Supabase Auth → Providers → Google. |
| **Vercel** | (not set up yet) | **Not configured** | Deploy when MVP is buildable end-to-end. Will need to paste every `.env.local` var into Project Settings → Environment Variables. |
| **PostHog** | (not set up) | Optional | Skipped for MVP. |

---

## Supabase Dashboard — Actions Taken

### 2026-05-07
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
| 1 | **OpenRouter has $0 credits.** | Add credits before running any AI route. `/api/search` will compile and stream-init but the upstream call will 402. |
| 2 | **Resend has no verified domain.** | Before FRD-9 launches, verify the sending domain (e.g. `uw-wiki.ca`) and update `EMAIL_FROM`. Until then, only `onboarding@resend.dev` will deliver. |
| 3 | **Google OAuth not wired.** | FRD-6 will need a Google Cloud project + OAuth 2.0 client. Steps documented in the prior chat summary; not done yet. |
| 4 | **Migration ordering bug fixed.** | `001_init_foundation.sql` originally declared `is_anonymous_report()` *after* a policy that referenced it — Postgres rejects this. Fixed in commit before first apply. |
| 5 | **`organizations.claimed_status` is dead-weight.** | The Round 2 reconciliation dropped the page-claim flow, but the migration still creates this column with default `'unclaimed'`. FRD-2's migration (`002_wiki_pages.sql`) should drop it. |
| 6 | **`lifecycle_config` schema mismatch with FRD-2.** | Migration creates 2 thresholds (`needs_update_days`, `outdated_days`); FRD-2 §9.2 specifies 3 (Needs Update / Stale / Potentially Defunct). Reconcile in `002_wiki_pages.sql`. |
| 7 | **Node.js 20 + Supabase JS in standalone scripts.** | The realtime client needs `ws` on Node < 22. Standalone scripts in `scripts/` should use raw `fetch` against PostgREST instead of `createClient` (see `scripts/smoke-test-supabase.mjs`). Next.js itself is fine — Node ≥ 22 isn't required. |
| 8 | **Docker not used.** | Deployment is Vercel + managed Supabase. The optional "Local-full mode" Docker setup in FRD-0 §3 is intentionally skipped. |

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

---

## What's Still Owed Before Production

- Add OpenRouter credits.
- Verify a Resend sending domain (FRD-9).
- Configure Google OAuth in Google Cloud + Supabase Auth (FRD-6).
- Create a Vercel project, paste env vars, link to GitHub repo.
- Decide on a production sender domain for `EMAIL_FROM`.
- Disable legacy Supabase JWT keys after end-to-end auth confirmed.
