# UW Wiki Testing Guide

## Fast Local Health Check

From `UW-Wiki/`:

```sh
npm run typecheck
npm run lint
npm run build
node scripts/smoke-test-supabase.mjs
node scripts/smoke-test-frd234.mjs
node scripts/smoke-test-audit-fixes.mjs
node scripts/smoke-test-frd567.mjs
node scripts/smoke-test-frd89.mjs
```

If a dev server is running at `NEXT_PUBLIC_APP_URL`, also run:

```sh
node scripts/smoke-auth-probes.mjs
```

## Smoke Script Catalog

| Script | Purpose |
|---|---|
| `smoke-test-supabase.mjs` | Verifies all baseline tables are reachable. |
| `smoke-test-tools.mjs` | Checks AI tool data for org/Pulse facts. |
| `smoke-test-embeddings.mjs` | Verifies OpenRouter embeddings return 512-dim vectors. |
| `smoke-ingest-seed-page.mjs` | Embeds seeded wiki pages into `chunks`. |
| `smoke-test-rag.mjs` | Verifies RAG semantic/keyword retrieval. |
| `smoke-test-frd234.mjs` | Checks wiki/comments/proposals schema. |
| `smoke-test-audit-fixes.mjs` | Checks RLS/RPC hardening and hidden-comment RAG filtering. |
| `smoke-test-frd567.mjs` | Checks cold-start/auth/admin schema. |
| `smoke-test-frd89.mjs` | Checks bookmarks/notifications schema and review-comment RLS. |
| `smoke-auth-probes.mjs` | Checks anonymous redirect behavior for protected pages. |
| `ensure-dev-role.mjs` | Sets an existing auth user's app role and optional affiliation for manual testing. |
| `list-users-roles.mjs` | Lists recent app users and roles for sanity checks. |

## Account Matrix

| Account Type | What To Test |
|---|---|
| Anonymous | Browse directory/wiki, ask AI search, create anonymous comment/proposal through API/UI paths, auth modal pending action prompts. |
| Signed-in user | Pulse votes, comment votes/replies, bookmarks, `/my/bookmarks`, `/my/contributions`, `/my/profile`, `/my/notifications`. |
| Reviewer | `/admin/reviews`, accept/reject/request changes, reports hide/unhide/dismiss. |
| Admin | Cold Start, lifecycle config, official section seeding, users/roles/affiliations, activity log, all reviewer paths. |

Use `scripts/ensure-dev-role.mjs` after creating/signing in a user once.

## Browser QA Checklist

1. Directory loads and filters.
2. Wiki page renders TOC, Pulse, comments, bookmark button, proposal editor, and history.
3. Pending actions replay after sign-in for Pulse vote, comment vote, and bookmark toggle.
4. `/my/bookmarks` lists bookmarked pages and can remove them.
5. `/my/contributions` lists attributed proposals and links to proposal details.
6. `/my/profile` manages affiliations and notification preferences.
7. `/my/notifications` lists notifications and can mark read/all read.
8. Reviewer request-changes creates a visible contributor notification.
9. Admin Cold Start can identify, generate, preview, publish, and show a cold-start wiki page.
10. Admin moderation actions write rows to `admin_activity_log`.

## Manual External Checks

- Google OAuth requires Google Cloud + Supabase provider setup.
- Email verification, password reset, and notification email require Supabase/Resend email configuration.
- Vercel cron digest requires deployed `vercel.json` and `CRON_SECRET`.
