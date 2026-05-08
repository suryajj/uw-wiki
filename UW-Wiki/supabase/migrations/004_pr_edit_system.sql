-- =====================================================================
-- FRD-4 PR-Edit System Migration
-- Adds section-scoped proposal columns + patchset table + indexes per
-- FRD-4 §3 and Appendix B. The baseline FRD-0 already provides
-- `edit_proposals`, `is_anonymous`, `is_from_affiliated_contributor`,
-- `section_slugs`, `proposed_content_json`, `reviewer_*`, and `status`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- edit_proposals: add base/version, mergeability, patchset pointer
-- ---------------------------------------------------------------------
alter table public.edit_proposals
  add column if not exists base_page_version_id uuid references public.page_versions(id);

alter table public.edit_proposals
  add column if not exists current_patchset_number integer not null default 1;

alter table public.edit_proposals
  add column if not exists mergeability_status text not null default 'unknown';

alter table public.edit_proposals
  drop constraint if exists edit_proposals_mergeability_check;

alter table public.edit_proposals
  add constraint edit_proposals_mergeability_check
  check (mergeability_status in ('unknown', 'mergeable', 'needs_rebase', 'conflict'));

-- Make `proposed_content_json` nullable so new section-scoped proposals
-- can rely on the patchset's section_diffs JSONB instead of a full doc.
alter table public.edit_proposals
  alter column proposed_content_json drop not null;

-- Drop and re-add the status check to match FRD-4 §3.1 amendment.
alter table public.edit_proposals
  drop constraint if exists edit_proposals_status_check;

alter table public.edit_proposals
  add constraint edit_proposals_status_check
  check (status in ('pending', 'changes_requested', 'needs_rebase', 'accepted', 'rejected', 'withdrawn'));

create index if not exists idx_edit_proposals_status_created
  on public.edit_proposals (status, created_at);

create index if not exists idx_edit_proposals_section_slugs
  on public.edit_proposals using gin (section_slugs);

create index if not exists idx_edit_proposals_base_version
  on public.edit_proposals (base_page_version_id);

-- ---------------------------------------------------------------------
-- edit_proposal_patchsets table
-- ---------------------------------------------------------------------
create table if not exists public.edit_proposal_patchsets (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.edit_proposals(id) on delete cascade,
  patchset_number integer not null,
  base_page_version_id uuid not null references public.page_versions(id),
  section_diffs jsonb not null,
  rationale text not null,
  is_current boolean not null default true,
  contributor_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (proposal_id, patchset_number)
);

create unique index if not exists idx_edit_proposal_patchsets_current
  on public.edit_proposal_patchsets (proposal_id)
  where is_current = true;

create index if not exists idx_edit_proposal_patchsets_proposal
  on public.edit_proposal_patchsets (proposal_id, patchset_number desc);

alter table public.edit_proposal_patchsets enable row level security;

create policy "public reads patchsets"
  on public.edit_proposal_patchsets for select using (true);

-- ---------------------------------------------------------------------
-- Atomic accept RPC: replace targeted sections in pages.content_json,
-- insert a new page_versions row, and bump pages.current_version_id.
-- The FRD-4 §6.1 pipeline is implemented in application code; this RPC
-- exists to make the version insert + page update atomic.
-- ---------------------------------------------------------------------
create or replace function public.accept_proposal_commit(
  p_proposal_id uuid,
  p_page_id uuid,
  p_new_content jsonb,
  p_reviewer_id uuid,
  p_summary text,
  p_is_admin_seeded boolean default false
)
returns table (
  new_version_id uuid,
  new_version_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
  v_version_id uuid;
  v_is_anonymous boolean;
  v_author_id uuid;
begin
  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.page_versions
   where page_id = p_page_id;

  select coalesce(p.is_anonymous, true), p.contributor_id
    into v_is_anonymous, v_author_id
    from public.edit_proposals p
   where p.id = p_proposal_id;

  insert into public.page_versions (
    page_id, content_json, is_current, is_anonymous, is_admin_seeded,
    author_id, edit_summary, version_number, summary
  ) values (
    p_page_id, p_new_content, true, coalesce(v_is_anonymous, true), p_is_admin_seeded,
    v_author_id, p_summary, v_next_version, p_summary
  )
  returning id into v_version_id;

  update public.page_versions
     set is_current = false
   where page_id = p_page_id
     and id <> v_version_id;

  update public.pages
     set current_version_id = v_version_id,
         content_json = p_new_content,
         last_modified_at = now()
   where id = p_page_id;

  update public.edit_proposals
     set status = 'accepted',
         reviewer_id = p_reviewer_id,
         decided_at = now(),
         updated_at = now(),
         mergeability_status = 'mergeable'
   where id = p_proposal_id;

  return query select v_version_id, v_next_version;
end;
$$;

grant execute on function public.accept_proposal_commit(uuid, uuid, jsonb, uuid, text, boolean)
  to anon, authenticated, service_role;
