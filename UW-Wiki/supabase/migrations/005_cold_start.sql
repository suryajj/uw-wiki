-- =====================================================================
-- FRD-5 Cold Start Agent Migration
-- Adds persistent admin-only job state for identification, research,
-- synthesis, preview, publish, and rerun flows.
-- =====================================================================

create table if not exists public.cold_start_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users(id) on delete set null,
  supersedes_job_id uuid references public.cold_start_jobs(id) on delete set null,
  input_text text not null,
  input_type text not null default 'name'
    check (input_type in ('name', 'url')),
  status text not null default 'draft'
    check (status in (
      'draft',
      'identifying',
      'awaiting_confirmation',
      'researching',
      'synthesizing',
      'ready_for_preview',
      'published',
      'failed',
      'cancelled'
    )),
  category_hint text check (
    category_hint is null or category_hint in (
      'Design Teams',
      'Engineering Clubs',
      'Non-Engineering Clubs',
      'Academic Programs',
      'Student Societies',
      'Campus Organizations'
    )
  ),
  org_metadata jsonb not null default '{}'::jsonb,
  research_data jsonb not null default '{}'::jsonb,
  draft_content_json jsonb,
  pulse_estimates jsonb not null default '{}'::jsonb,
  section_sources jsonb not null default '{}'::jsonb,
  section_progress jsonb not null default '[]'::jsonb,
  tavily_call_count integer not null default 0,
  current_step text,
  error text,
  published_org_id uuid references public.organizations(id) on delete set null,
  published_page_id uuid references public.pages(id) on delete set null,
  published_page_version_id uuid references public.page_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_cold_start_jobs_created_by_status
  on public.cold_start_jobs (created_by, status, created_at desc);

create index if not exists idx_cold_start_jobs_status_created
  on public.cold_start_jobs (status, created_at desc);

create index if not exists idx_cold_start_jobs_supersedes
  on public.cold_start_jobs (supersedes_job_id);

alter table public.cold_start_jobs enable row level security;

drop policy if exists "reviewers read cold_start_jobs" on public.cold_start_jobs;
create policy "reviewers read cold_start_jobs"
  on public.cold_start_jobs for select
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('reviewer', 'admin')
    )
  );

-- Mutations are performed by trusted route handlers with the service role.
-- No public/authenticated insert/update/delete policies are added.
