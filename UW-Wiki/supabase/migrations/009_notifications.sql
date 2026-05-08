-- =====================================================================
-- FRD-9 Notifications
-- Upgrades FRD-0 notification stubs into typed in-app/email prefs.
-- =====================================================================

alter table public.notifications
  add column if not exists type text not null default 'page.updated';

alter table public.notifications
  add column if not exists delivered_email boolean not null default false;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'pr.accepted',
    'pr.rejected',
    'pr.changes_requested',
    'pr.needs_rebase',
    'comment.reply',
    'page.updated'
  ));

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notification_preferences
  add column if not exists in_app_pr_status boolean not null default true,
  add column if not exists email_pr_status boolean not null default true,
  add column if not exists in_app_comment_reply boolean not null default true,
  add column if not exists email_comment_reply boolean not null default true,
  add column if not exists email_page_update_digest boolean not null default true,
  add column if not exists page_update_digest_frequency text not null default 'daily',
  add column if not exists last_digest_sent_at timestamptz;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_digest_frequency_check;

alter table public.notification_preferences
  add constraint notification_preferences_digest_frequency_check
  check (page_update_digest_frequency in ('daily', 'weekly', 'never'));
