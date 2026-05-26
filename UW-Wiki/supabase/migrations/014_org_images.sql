-- 014_org_images.sql
-- Org-scoped image table. Designed for multi-image use (article header
-- image first, with `kind='inline'` reserved for future embedded images
-- inside article body content).
--
-- Workflow: any signed-in user can submit a header image proposal; it
-- lands as `status='pending'`. Admins moderate from /admin/reviews and
-- flip to 'accepted' or 'rejected'. The displayed header image on a wiki
-- article is always the most-recent accepted row for that org with
-- `kind='header'`.
--
-- Storage path lives in the existing `wiki-images` bucket — see
-- src/lib/editor/upload.ts. Path scheme: `orgs/<org_id>/<uuid>.<ext>`.

create table public.org_images (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- 'header' is the article banner (one displayed per article = latest accepted).
  -- 'inline' is reserved for images embedded in section body content via the
  -- editor — those don't drive page-level display, but storing them here lets
  -- us audit / orphan-clean later.
  kind text not null check (kind in ('header', 'inline')),

  -- Review pipeline state. Admin uploads skip 'pending' (created already
  -- 'accepted'); everyone else starts pending and waits for moderation.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),

  storage_path text not null,
  alt text not null check (length(alt) between 1 and 280),
  caption text check (caption is null or length(caption) between 1 and 280),

  uploaded_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookup pattern: "latest accepted header image for org X".
create index org_images_org_kind_status_created_idx
  on public.org_images (org_id, kind, status, created_at desc);

-- Moderation queue: "pending images, oldest first".
create index org_images_pending_idx
  on public.org_images (status, created_at asc)
  where status = 'pending';

-- `updated_at` is bumped explicitly by the admin moderation API on every
-- write — no trigger needed (the codebase doesn't ship a shared
-- `set_updated_at()` helper).

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.org_images enable row level security;

-- Anyone (anon + authenticated) can read ACCEPTED images. Pending/
-- rejected rows are admin-only — visitors should never see a pending
-- proposal on the live article.
create policy org_images_public_read on public.org_images
  for select
  using (status = 'accepted');

-- The uploader can see their own pending/rejected rows so the editor UI
-- can show "your image is awaiting review".
create policy org_images_owner_read on public.org_images
  for select
  to authenticated
  using (uploaded_by = auth.uid());

-- All inserts go through the service role (the API route) so we don't
-- need a permissive insert policy here. The service role bypasses RLS,
-- and direct anon/auth PostgREST writes are not a flow we support for
-- this table.

-- Same story for updates and deletes: only the admin API touches them.
-- Leaving without policies = locked down for non-service-role traffic.

comment on table public.org_images is
  'Org-scoped image library. Header image per article surfaces from latest accepted kind=header row. Future inline images embed via editor; recorded here for orphan auditing.';
