-- =====================================================================
-- FRD-5/6/7 Audit Fixes
-- Tightens proposal review comment visibility after the FRD-7 audit.
-- =====================================================================

drop policy if exists "public reads proposal review comments" on public.proposal_review_comments;
drop policy if exists "review participants read proposal review comments" on public.proposal_review_comments;

create policy "review participants read proposal review comments"
  on public.proposal_review_comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('reviewer', 'admin')
    )
    or exists (
      select 1
      from public.edit_proposals p
      where p.id = proposal_review_comments.proposal_id
        and p.contributor_id = auth.uid()
    )
  );
