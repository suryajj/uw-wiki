-- =====================================================================
-- Remove the bookmarked-page-update digest email feature.
-- Drops the cron-driven digest columns and their check constraint.
-- The in_app_page_update column is kept (no longer fired, but reserved).
-- =====================================================================

alter table public.notification_preferences
  drop constraint if exists notification_preferences_digest_frequency_check;

alter table public.notification_preferences
  drop column if exists email_page_update_digest,
  drop column if exists page_update_digest_frequency,
  drop column if exists last_digest_sent_at;
