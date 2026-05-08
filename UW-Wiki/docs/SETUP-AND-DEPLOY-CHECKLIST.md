# Setup And Deploy Checklist

## External Accounts

- Supabase project with Auth and Postgres.
- Vercel project linked to GitHub.
- OpenRouter account with credits.
- Upstash Redis REST database.
- Tavily API key.
- Resend account with verified sending domain.
- Google Cloud OAuth client.

## Supabase

1. Enable `vector` extension.
2. Apply migrations in order from `supabase/migrations/`.
3. Run `supabase/seed.sql`.
4. Configure Auth email provider and redirect URLs.
5. Configure Google Auth provider after creating Google OAuth credentials.
6. Keep service role key server-only.

Because current migration history is drifted, use direct migration application until repaired. Apply all missing migrations in FRD order, including audit fixes before notifications:

```sh
npx supabase db query --linked --file supabase/migrations/008_audit_fixes.sql
npx supabase db query --linked --file supabase/migrations/009_notifications.sql
npx supabase db query --linked --file supabase/migrations/010_notification_page_update_prefs.sql
```

## Vercel

1. Import GitHub repo.
2. Set root directory to `UW-Wiki`.
3. Add every variable from `.env.example`.
4. Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
5. Set `CRON_SECRET` and verify `/api/cron/notifications-digest`.
6. Confirm `vercel.json` registers the daily notification digest cron.

## Google OAuth

1. Create OAuth consent screen.
2. Create Web OAuth client.
3. Add Supabase callback URL from Supabase Auth provider settings.
4. Paste Client ID/Secret into Supabase Auth -> Providers -> Google.
5. Add deployed app redirect URLs.

## Resend

1. Verify a domain.
2. Set `EMAIL_FROM` to an address on that domain.
3. Add `RESEND_API_KEY` to Vercel.
4. Test email verification, password reset, comment reply notification, and PR status notification.

## Post-Deploy Smoke

```sh
npm run build
node scripts/smoke-test-supabase.mjs
node scripts/smoke-test-frd234.mjs
node scripts/smoke-test-audit-fixes.mjs
node scripts/smoke-test-frd567.mjs
node scripts/smoke-test-frd89.mjs
```

Then manually test the account matrix in `docs/TESTING-GUIDE.md`.
