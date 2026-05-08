-- =====================================================================
-- FRD-3 Comments System Migration
-- Adds the columns FRD-3 §14 expects on top of the FRD-0 baseline.
-- The comment_votes table in FRD-0 uses `vote SMALLINT (-1, 1)`; FRD-3
-- expects `vote_type TEXT('up' | 'down')`. We migrate by adding the
-- text column, mapping existing rows, and replacing the check constraint.
-- =====================================================================

-- ---------------------------------------------------------------------
-- comments: add reporting + ordering columns referenced by FRD-3
-- ---------------------------------------------------------------------
alter table public.comments
  add column if not exists report_count integer not null default 0;

-- Section_slug already exists in FRD-0 baseline; just ensure index is present.
create index if not exists idx_comments_user_id on public.comments (author_id);
create index if not exists idx_comments_section_slug on public.comments (page_id, section_slug);
create index if not exists idx_comments_created_at on public.comments (created_at desc);

-- ---------------------------------------------------------------------
-- comment_votes: add `vote_type` text to match FRD-3 schema
-- ---------------------------------------------------------------------
alter table public.comment_votes
  add column if not exists vote_type text;

update public.comment_votes
   set vote_type = case when vote = 1 then 'up' else 'down' end
 where vote_type is null;

alter table public.comment_votes
  alter column vote_type set not null;

alter table public.comment_votes
  drop constraint if exists comment_votes_vote_check;

alter table public.comment_votes
  add constraint comment_votes_vote_type_check
  check (vote_type in ('up', 'down'));

-- ---------------------------------------------------------------------
-- comment_reports: align with FRD-3 §14.3 columns
-- ---------------------------------------------------------------------
alter table public.comment_reports
  add column if not exists details text;
alter table public.comment_reports
  add column if not exists resolved_by uuid references public.users(id);
alter table public.comment_reports
  add column if not exists resolved_at timestamptz;

-- Replace status check to match FRD-3 ('pending'/'resolved'/'dismissed').
update public.comment_reports
   set status = case status
     when 'open'      then 'pending'
     when 'actioned'  then 'resolved'
     else status
   end
 where status in ('open', 'actioned');

alter table public.comment_reports
  alter column status set default 'pending';

alter table public.comment_reports
  drop constraint if exists comment_reports_status_check;

alter table public.comment_reports
  add constraint comment_reports_status_check
  check (status in ('pending', 'resolved', 'dismissed'));

alter table public.comment_reports
  drop constraint if exists comment_reports_reason_check;

alter table public.comment_reports
  add constraint comment_reports_reason_check
  check (reason in ('spam', 'harassment', 'misinformation', 'other'));

create index if not exists idx_comment_reports_status on public.comment_reports (status);

-- ---------------------------------------------------------------------
-- Comment hide policy: prevent reads of hidden comments through API.
-- The base policy already filters on is_hidden = false.
-- ---------------------------------------------------------------------
