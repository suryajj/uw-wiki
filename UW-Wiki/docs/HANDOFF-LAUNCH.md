# UW Wiki Launch Handoff

This is the current launch-oriented snapshot. `HANDOFF.md` remains the chronological source of truth for external state changes.

## Current Build State

- FRD-0 through FRD-9 are implemented in the app codebase.
- Supabase migrations now run through `009_notifications.sql`.
- Core routes include wiki pages, RAG search, comments, proposals, cold-start admin, auth/profile, bookmarks/contributions, admin dashboard, and notifications.
- Deployment target is Vercel + managed Supabase. Docker is intentionally not part of the MVP path.

## Environment Matrix

Use `.env.example` as the source for required variables. Local and Vercel must both define:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `NEXT_PUBLIC_SUPABASE_ANON_KEY` is an optional legacy alias used by some smoke scripts when present.
- AI/RAG: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_X_TITLE`
- Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Cold Start: `TAVILY_API_KEY`
- Notifications: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`
- App: `NEXT_PUBLIC_APP_URL`

## External Services

| Service | Required For | Launch Notes |
|---|---|---|
| Supabase | Auth, database, RLS, storage-ready backend | Project is linked but migration history is drifted; use direct `db query --linked --file` until repaired. |
| OpenRouter | Embeddings and AI search synthesis | Add credits before heavy testing. Keep output caps. |
| Upstash | Rate limits | Free tier is enough for MVP testing. |
| Tavily | Cold Start research | The app has deterministic fallback, but real research quality needs Tavily. |
| Resend | Notification email | Verify sending domain before production. |
| Google Cloud OAuth | Google sign-in | Not configured yet; wire into Supabase Auth providers. |
| Vercel | Hosting and daily digest cron | Add env vars and verify cron route protection with `CRON_SECRET`. |

## Database Operations

Apply migrations in FRD order from `supabase/migrations/`; do not rely on naive lexicographic sorting because files like `0011_rag_search_functions.sql` intentionally sit between feature rounds. Because the linked project has migration-history drift, the safest current command is:

```sh
npx supabase db query --linked --file supabase/migrations/<file>.sql
```

After migration, run:

```sh
node scripts/smoke-test-supabase.mjs
node scripts/smoke-test-audit-fixes.mjs
node scripts/smoke-test-frd567.mjs
node scripts/smoke-test-frd89.mjs
```

## Known Production Blockers

- Configure Google OAuth in Google Cloud and Supabase.
- Verify Resend domain and set `EMAIL_FROM` to that domain.
- Repair Supabase migration history before relying on `supabase db push`.
- Create real admin and reviewer test accounts.
- Confirm OpenRouter credits are sufficient for RAG and Cold Start testing.
- Decide whether to add a dedicated cold-start system user for Pulse provenance.
