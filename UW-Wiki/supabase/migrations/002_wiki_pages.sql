-- =====================================================================
-- FRD-2 Wiki Pages, Directory, Editor, and Pulse Migration
-- Adds tagline + Official-section affiliation flags. The page-claim flow
-- is intentionally NOT added; affiliation is in user_affiliations baseline.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pages: track current_version_id used by SSR + version history
-- ---------------------------------------------------------------------
alter table public.pages
  add column if not exists slug text;

-- Backfill page slug from organization slug (one page per org).
update public.pages p
   set slug = o.org_slug
  from public.organizations o
 where p.org_id = o.id
   and p.slug is null;

create unique index if not exists pages_slug_unique on public.pages (slug);

-- ---------------------------------------------------------------------
-- Page versions: number sequence per page + cold-start banner support
-- ---------------------------------------------------------------------
alter table public.page_versions
  add column if not exists version_number integer;

alter table public.page_versions
  add column if not exists is_cold_start boolean not null default false;

alter table public.page_versions
  add column if not exists summary text;

-- Backfill version_number with 1 for the seeded version row, if present.
do $$
begin
  if exists (
    select 1
      from public.page_versions
     where version_number is null
  ) then
    update public.page_versions
       set version_number = 1
     where version_number is null;
  end if;
end $$;

create index if not exists idx_page_versions_page_id_version_number
  on public.page_versions (page_id, version_number desc);

-- ---------------------------------------------------------------------
-- Lifecycle thresholds: store all 3 thresholds (needs update / stale /
-- potentially defunct) used by FRD-2 §9.2.
-- ---------------------------------------------------------------------
alter table public.lifecycle_config
  add column if not exists stale_days integer;
alter table public.lifecycle_config
  add column if not exists defunct_days integer;

-- Map FRD-0 baseline `outdated_days` onto stale_days for backward compat
-- and seed the defunct threshold from FRD-2 §9.2.
update public.lifecycle_config
   set stale_days = coalesce(stale_days, outdated_days);

update public.lifecycle_config
   set defunct_days = coalesce(defunct_days, case category
     when 'Design Teams'         then 720
     when 'Engineering Clubs'    then 540
     when 'Non-Engineering Clubs' then 540
     when 'Academic Programs'    then 1080
     when 'Student Societies'    then 540
     when 'Campus Organizations' then 1080
   end);

-- Align FRD-2 needs-update + stale thresholds. Engineering Clubs uses
-- 6/12/18 months; Student Societies uses 12/12/18 per round 2 reconciliation.
update public.lifecycle_config
   set needs_update_days = case category
     when 'Design Teams'         then 270
     when 'Engineering Clubs'    then 180
     when 'Non-Engineering Clubs' then 180
     when 'Academic Programs'    then 365
     when 'Student Societies'    then 365
     when 'Campus Organizations' then 365
   end,
   stale_days = case category
     when 'Design Teams'         then 450
     when 'Engineering Clubs'    then 365
     when 'Non-Engineering Clubs' then 365
     when 'Academic Programs'    then 720
     when 'Student Societies'    then 365
     when 'Campus Organizations' then 720
   end,
   defunct_days = case category
     when 'Design Teams'         then 720
     when 'Engineering Clubs'    then 540
     when 'Non-Engineering Clubs' then 540
     when 'Academic Programs'    then 1080
     when 'Student Societies'    then 540
     when 'Campus Organizations' then 1080
   end;

-- ---------------------------------------------------------------------
-- Pulse ratings + aggregates: align FRD-2 §3.4
-- ---------------------------------------------------------------------
alter table public.pulse_aggregates
  add column if not exists last_computed_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- Organizations: tagline already exists. claimed_status is dead-weight
-- post round-2 reconciliation; we leave the column in place for FRD-0
-- compatibility but stop relying on it in product code.
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists tagline text;
