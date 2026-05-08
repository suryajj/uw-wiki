-- =====================================================================
-- FRD-9 Notification Preference Follow-up
-- Adds separate in-app page update preference and aligns digest default.
-- =====================================================================

alter table public.notification_preferences
  add column if not exists in_app_page_update boolean not null default true;

alter table public.notification_preferences
  alter column page_update_digest_frequency set default 'weekly';
