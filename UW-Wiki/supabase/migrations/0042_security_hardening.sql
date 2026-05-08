-- =====================================================================
-- FRD audit hardening migration (post FRD-0..4 review)
-- 1. Lock SECURITY DEFINER RPCs to service_role only (defense in depth).
-- 2. Tighten anonymous-insert RLS so anon JWTs can no longer write directly
--    to comments / edit_proposals / comment_reports via PostgREST. The API
--    routes already use the service role, so this is no behaviour change for
--    the app while closing the public write surface.
-- 3. Persist FRD-3 anchor status and FRD-4 reviewer-affiliation snapshot.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RPC EXECUTE grants
-- ---------------------------------------------------------------------
revoke execute on function public.accept_proposal_commit(uuid, uuid, jsonb, uuid, text, boolean) from public;
revoke execute on function public.accept_proposal_commit(uuid, uuid, jsonb, uuid, text, boolean) from anon;
revoke execute on function public.accept_proposal_commit(uuid, uuid, jsonb, uuid, text, boolean) from authenticated;
grant execute on function public.accept_proposal_commit(uuid, uuid, jsonb, uuid, text, boolean) to service_role;

revoke execute on function public.increment_comment_vote(uuid, integer, integer) from public;
revoke execute on function public.increment_comment_vote(uuid, integer, integer) from anon;
revoke execute on function public.increment_comment_vote(uuid, integer, integer) from authenticated;
grant execute on function public.increment_comment_vote(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 2. Anonymous-insert RLS hardening
--    Replace the permissive `is_anonymous = true` insert policies with
--    auth-only writes. Anonymous writes from the product still work
--    because the API uses the service role (RLS bypass), but a leaked
--    anon JWT can no longer post comments / proposals / reports directly.
-- ---------------------------------------------------------------------
drop policy if exists "auth user inserts comment" on public.comments;
create policy "auth user inserts comment"
  on public.comments for insert
  with check (auth.uid() is not null);

drop policy if exists "auth user inserts edit_proposal" on public.edit_proposals;
create policy "auth user inserts edit_proposal"
  on public.edit_proposals for insert
  with check (auth.uid() is not null);

drop policy if exists "user inserts comment_report" on public.comment_reports;
create policy "user inserts comment_report"
  on public.comment_reports for insert
  with check (auth.uid() = reporter_id);

-- The dead is_anonymous_report() helper from FRD-0 had no callers besides the
-- removed policy. Drop it to avoid dead-weight in the schema.
drop function if exists public.is_anonymous_report();

-- ---------------------------------------------------------------------
-- 3. Persist anchor status + reviewer affiliation snapshot
-- ---------------------------------------------------------------------
alter table public.comments
  add column if not exists is_anchored boolean not null default true;

alter table public.edit_proposals
  add column if not exists last_decision_log jsonb;

create index if not exists idx_comments_is_anchored
  on public.comments (page_id, is_anchored);
