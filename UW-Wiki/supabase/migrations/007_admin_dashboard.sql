-- =====================================================================
-- FRD-7 Admin Dashboard Migration
-- Adds append-only admin audit log and structured proposal review comments.
-- =====================================================================

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_log_created
  on public.admin_activity_log (created_at desc);

create index if not exists idx_admin_activity_log_actor
  on public.admin_activity_log (actor_id, created_at desc);

create index if not exists idx_admin_activity_log_entity
  on public.admin_activity_log (entity_type, entity_id, created_at desc);

alter table public.admin_activity_log enable row level security;

drop policy if exists "admins read activity log" on public.admin_activity_log;
create policy "admins read activity log"
  on public.admin_activity_log for select
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

create table if not exists public.proposal_review_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.edit_proposals(id) on delete cascade,
  patchset_id uuid references public.edit_proposal_patchsets(id) on delete set null,
  reviewer_id uuid references public.users(id) on delete set null,
  message text not null check (char_length(message) between 10 and 2000),
  section_suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposal_review_comments_proposal
  on public.proposal_review_comments (proposal_id, created_at desc);

alter table public.proposal_review_comments enable row level security;

drop policy if exists "public reads proposal review comments" on public.proposal_review_comments;
create policy "public reads proposal review comments"
  on public.proposal_review_comments for select using (true);

-- Mutations are performed by trusted route handlers with the service role.
