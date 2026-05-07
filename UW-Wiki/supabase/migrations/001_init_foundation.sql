-- =====================================================================
-- FRD-0 Foundation Migration
-- Creates all baseline tables, forward-compat fields for FRDs 2-3,
-- chunks table for FRD-1, indexes, RLS policies, and user sync trigger.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Universities (multi-university ready)
-- ---------------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Users (mirror of auth.users with public-readable profile fields)
-- ---------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Organizations
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  org_slug text not null,
  org_name text not null,
  category text not null check (category in (
    'Design Teams',
    'Engineering Clubs',
    'Non-Engineering Clubs',
    'Academic Programs',
    'Student Societies',
    'Campus Organizations'
  )),
  tagline text,
  claimed_status text not null default 'unclaimed' check (claimed_status in ('unclaimed', 'claimed')),
  created_at timestamptz not null default now(),
  unique (university_id, org_slug)
);

-- ---------------------------------------------------------------------
-- 5. Pages and Page Versions
-- ---------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  current_version_id uuid,  -- FK added after page_versions exists
  content_json jsonb,
  created_at timestamptz not null default now(),
  last_modified_at timestamptz not null default now(),
  unique (org_id)
);

create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  content_json jsonb not null,
  is_current boolean not null default false,
  is_anonymous boolean not null default false,
  is_admin_seeded boolean not null default false,
  author_id uuid references public.users(id) on delete set null,
  edit_summary text,
  created_at timestamptz not null default now()
);

alter table public.pages
  add constraint pages_current_version_fk
  foreign key (current_version_id) references public.page_versions(id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. Edit Proposals
-- ---------------------------------------------------------------------
create table public.edit_proposals (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  base_version_id uuid not null references public.page_versions(id) on delete cascade,
  contributor_id uuid references public.users(id) on delete set null,
  is_anonymous boolean not null default false,
  is_from_affiliated_contributor boolean not null default false,
  section_slugs text[] not null default '{}',
  proposed_content_json jsonb not null,
  rationale text,
  status text not null default 'pending' check (status in (
    'pending', 'changes_requested', 'needs_rebase', 'accepted', 'rejected', 'withdrawn'
  )),
  reviewer_id uuid references public.users(id) on delete set null,
  reviewer_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Comments + voting/reporting
-- ---------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  is_anonymous boolean not null default true,
  section_slug text,
  anchor_text text,
  body text not null check (length(body) <= 1500),
  is_edited boolean not null default false,
  is_hidden boolean not null default false,
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid references public.users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

-- Atomic upvote/downvote increment used by FRD-3 vote endpoint.
create or replace function public.increment_comment_vote(
  p_comment_id uuid,
  p_delta_up integer,
  p_delta_down integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comments
     set upvotes   = greatest(0, upvotes   + p_delta_up),
         downvotes = greatest(0, downvotes + p_delta_down)
   where id = p_comment_id;
$$;

-- ---------------------------------------------------------------------
-- 8. Pulse (community ratings)
-- ---------------------------------------------------------------------
create table public.pulse_ratings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  metric text not null check (metric in ('selectivity', 'vibe_check', 'coop_boost', 'tech_stack')),
  value text not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id, metric)
);

create table public.pulse_aggregates (
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null check (metric in ('selectivity', 'vibe_check', 'coop_boost', 'tech_stack')),
  aggregate_value text not null,
  aggregate_label text not null,
  total_votes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, metric)
);

-- ---------------------------------------------------------------------
-- 9. External Links
-- ---------------------------------------------------------------------
create table public.external_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. Bookmarks
-- ---------------------------------------------------------------------
create table public.bookmarks (
  user_id uuid not null references public.users(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

-- ---------------------------------------------------------------------
-- 11. User Affiliations (FRD-2 self-declared model, managed by admins in FRD-7)
-- ---------------------------------------------------------------------
create table public.user_affiliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

-- ---------------------------------------------------------------------
-- 12. Notifications (stub — full schema in FRD-9)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 13. Lifecycle config
-- ---------------------------------------------------------------------
create table public.lifecycle_config (
  category text primary key check (category in (
    'Design Teams',
    'Engineering Clubs',
    'Non-Engineering Clubs',
    'Academic Programs',
    'Student Societies',
    'Campus Organizations'
  )),
  needs_update_days integer not null,
  outdated_days integer not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 14. Chunks (FRD-1 RAG)
-- ---------------------------------------------------------------------
create table public.chunks (
  id uuid primary key default gen_random_uuid(),

  -- internal: lifecycle and scoping
  university_id uuid not null references public.universities(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  page_version_id uuid references public.page_versions(id) on delete cascade,
  source_comment_id uuid references public.comments(id) on delete cascade,

  -- LLM-facing
  chunk_type text not null check (chunk_type in ('content', 'comment')),
  org_name text not null,
  org_slug text not null,
  category text not null,
  section_title text,
  section_slug text,
  anchored_section text,
  chunk_index integer,
  references_previous_version boolean not null default false,

  -- content + search
  content_text text not null,
  content_tsvector tsvector generated always as (to_tsvector('english', content_text)) stored,
  embedding vector(512) not null,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 15. Indexes
-- ---------------------------------------------------------------------
-- Chunks: HNSW for semantic search, GIN for keyword search
create index idx_chunks_embedding on public.chunks using hnsw (embedding vector_cosine_ops);
create index idx_chunks_tsvector  on public.chunks using gin  (content_tsvector);
create index idx_chunks_org_id    on public.chunks (org_id);
create index idx_chunks_page_id   on public.chunks (page_id);
create index idx_chunks_source_comment on public.chunks (source_comment_id);
create index idx_chunks_type      on public.chunks (chunk_type);

-- Comment lifecycle queries
create index idx_comments_page_id     on public.comments (page_id);
create index idx_comments_section     on public.comments (page_id, section_slug);
create index idx_comments_parent      on public.comments (parent_comment_id);

-- Edit proposals
create index idx_edit_proposals_page_id   on public.edit_proposals (page_id);
create index idx_edit_proposals_status    on public.edit_proposals (status);
create index idx_edit_proposals_contributor on public.edit_proposals (contributor_id);

-- Pulse aggregates ranking
create index idx_pulse_aggregates_metric on public.pulse_aggregates (metric, aggregate_value desc);

-- Bookmarks
create index idx_bookmarks_user on public.bookmarks (user_id);

-- ---------------------------------------------------------------------
-- 16. User Profile Sync Trigger (FRD-0 §7.4)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 17. Row Level Security
-- ---------------------------------------------------------------------

-- Public-read tables (directory/page content)
alter table public.universities          enable row level security;
alter table public.organizations         enable row level security;
alter table public.pages                 enable row level security;
alter table public.page_versions         enable row level security;
alter table public.comments              enable row level security;
alter table public.pulse_aggregates      enable row level security;
alter table public.external_links        enable row level security;
alter table public.lifecycle_config      enable row level security;
alter table public.chunks                enable row level security;

create policy "public read universities"
  on public.universities for select using (true);
create policy "public read organizations"
  on public.organizations for select using (true);
create policy "public read pages"
  on public.pages for select using (true);
create policy "public read page_versions"
  on public.page_versions for select using (true);
create policy "public read non-hidden comments"
  on public.comments for select using (is_hidden = false);
create policy "public read pulse_aggregates"
  on public.pulse_aggregates for select using (true);
create policy "public read external_links"
  on public.external_links for select using (true);
create policy "public read lifecycle_config"
  on public.lifecycle_config for select using (true);
create policy "public read chunks"
  on public.chunks for select using (true);

-- User-scoped tables
alter table public.users                    enable row level security;
alter table public.user_affiliations        enable row level security;
alter table public.bookmarks                enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.pulse_ratings            enable row level security;
alter table public.edit_proposals           enable row level security;
alter table public.comment_votes            enable row level security;
alter table public.comment_reports          enable row level security;

-- users: anyone can read public profile fields; only the user can update their own row
create policy "public read users"
  on public.users for select using (true);
create policy "user can update own profile"
  on public.users for update using (auth.uid() = id);

-- bookmarks: only the user
create policy "user reads own bookmarks"
  on public.bookmarks for select using (auth.uid() = user_id);
create policy "user inserts own bookmark"
  on public.bookmarks for insert with check (auth.uid() = user_id);
create policy "user deletes own bookmark"
  on public.bookmarks for delete using (auth.uid() = user_id);

-- notifications: only the user
create policy "user reads own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "user updates own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "user reads own notification prefs"
  on public.notification_preferences for select using (auth.uid() = user_id);
create policy "user upserts own notification prefs"
  on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- pulse_ratings: user reads/writes own
create policy "user reads own pulse_rating"
  on public.pulse_ratings for select using (auth.uid() = user_id);
create policy "user inserts own pulse_rating"
  on public.pulse_ratings for insert with check (auth.uid() = user_id);
create policy "user updates own pulse_rating"
  on public.pulse_ratings for update using (auth.uid() = user_id);
create policy "user deletes own pulse_rating"
  on public.pulse_ratings for delete using (auth.uid() = user_id);

-- edit_proposals: anyone signed in can insert; everyone reads non-anonymous ones publicly
create policy "public reads edit_proposals"
  on public.edit_proposals for select using (true);
create policy "auth user inserts edit_proposal"
  on public.edit_proposals for insert with check (auth.uid() is not null or is_anonymous = true);

-- comment_votes: only the user
create policy "user reads own comment_vote"
  on public.comment_votes for select using (auth.uid() = user_id);
create policy "user inserts own comment_vote"
  on public.comment_votes for insert with check (auth.uid() = user_id);
create policy "user updates own comment_vote"
  on public.comment_votes for update using (auth.uid() = user_id);
create policy "user deletes own comment_vote"
  on public.comment_votes for delete using (auth.uid() = user_id);

-- comment_reports: anyone signed in can insert; reporter reads own; admins read all (server-enforced)
-- helper function MUST be created before the policy that references it
create or replace function public.is_anonymous_report()
returns boolean language sql immutable as $$ select false; $$;

create policy "user inserts comment_report"
  on public.comment_reports for insert with check (auth.uid() = reporter_id or is_anonymous_report());
create policy "user reads own comment_report"
  on public.comment_reports for select using (auth.uid() = reporter_id);

-- comments: insert allowed if user is authenticated (anonymous comments still attach an auth user via FRD-3)
create policy "auth user inserts comment"
  on public.comments for insert with check (auth.uid() is not null or is_anonymous = true);
create policy "author updates own comment"
  on public.comments for update using (auth.uid() = author_id);

-- user_affiliations: user reads own; admins manage all (server-enforced)
create policy "user reads own affiliations"
  on public.user_affiliations for select using (auth.uid() = user_id);
create policy "user inserts own affiliation"
  on public.user_affiliations for insert with check (auth.uid() = user_id);
