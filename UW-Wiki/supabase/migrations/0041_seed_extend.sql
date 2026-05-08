-- =====================================================================
-- FRD-2/3/4 Seed Extensions
-- Ensures the WATonomous sample page has a page_version (FRD-2 history),
-- a richer multi-section template (FRD-2/4 testing), and one extra org
-- so directory + multi-org tooling can be exercised.
-- =====================================================================

-- 1. Richer WATonomous content covering the FRD-2 template.
update public.pages
   set content_json = '{
        "type": "doc",
        "content": [
          {"type":"heading","attrs":{"level":2,"slug":"overview"},"content":[{"type":"text","text":"Overview"}]},
          {"type":"paragraph","content":[{"type":"text","text":"WATonomous is the University of Waterloo''s autonomous vehicle design team, building self-driving software in ROS2, C++, and Python. Members ship working systems on a real vehicle each year."}]},
          {"type":"heading","attrs":{"level":2,"slug":"time-commitment"},"content":[{"type":"text","text":"Time Commitment"}]},
          {"type":"paragraph","content":[{"type":"text","text":"Most members spend 8-12 hours per week during term, with build-season spikes around competitions."}]},
          {"type":"heading","attrs":{"level":2,"slug":"culture-and-vibe"},"content":[{"type":"text","text":"Culture and Vibe"}]},
          {"type":"paragraph","content":[{"type":"text","text":"Engineering-heavy, collaborative, and project-driven. Subteams run independently but coordinate often."}]},
          {"type":"heading","attrs":{"level":2,"slug":"subteams-and-roles"},"content":[{"type":"text","text":"Subteams and Roles"}]},
          {"type":"paragraph","content":[{"type":"text","text":"Perception, Path Planning, Controls, Infrastructure, Embedded, and Software Architecture."}]},
          {"type":"heading","attrs":{"level":2,"slug":"how-to-apply"},"content":[{"type":"text","text":"How to Apply"}]},
          {"type":"paragraph","content":[{"type":"text","text":"Applications open in September. Expect a short technical conversation with the relevant subteam lead."}]},
          {"type":"heading","attrs":{"level":2,"slug":"external-links"},"content":[{"type":"text","text":"External Links"}]},
          {"type":"paragraph","content":[{"type":"text","text":"Find their work at watonomous.ca and on GitHub."}]}
        ]
      }'::jsonb,
       last_modified_at = now()
 where id = '00000000-0000-0000-0000-000000000020';

-- 2. Ensure a page_version exists for WATonomous + page.current_version_id is set.
insert into public.page_versions (id, page_id, content_json, is_current, is_anonymous, is_admin_seeded, version_number, summary, created_at)
select
  '00000000-0000-0000-0000-000000000030',
  p.id,
  p.content_json,
  true,
  false,
  true,
  1,
  'Seed initial WATonomous page',
  now()
  from public.pages p
 where p.id = '00000000-0000-0000-0000-000000000020'
on conflict (id) do update
  set content_json = excluded.content_json,
      version_number = excluded.version_number;

update public.pages
   set current_version_id = '00000000-0000-0000-0000-000000000030'
 where id = '00000000-0000-0000-0000-000000000020'
   and current_version_id is null;

-- 3. Extra org so the directory has 2+ rows to exercise filter/sort.
insert into public.organizations (id, university_id, org_slug, org_name, category, tagline, claimed_status)
values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'midnight-sun',
  'Midnight Sun',
  'Design Teams',
  'University of Waterloo''s solar car design team.',
  'unclaimed'
)
on conflict (university_id, org_slug) do update set tagline = excluded.tagline;

insert into public.pages (id, org_id, content_json, slug, last_modified_at)
values (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000011',
  '{"type":"doc","content":[
    {"type":"heading","attrs":{"level":2,"slug":"overview"},"content":[{"type":"text","text":"Overview"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Midnight Sun designs and builds solar electric vehicles for endurance racing."}]}
  ]}'::jsonb,
  'midnight-sun',
  now()
)
on conflict (org_id) do update set content_json = excluded.content_json, slug = excluded.slug;

insert into public.page_versions (id, page_id, content_json, is_current, is_anonymous, is_admin_seeded, version_number, summary)
select
  '00000000-0000-0000-0000-000000000031',
  p.id,
  p.content_json,
  true,
  false,
  true,
  1,
  'Seed Midnight Sun'
  from public.pages p
 where p.id = '00000000-0000-0000-0000-000000000021'
on conflict (id) do nothing;

update public.pages
   set current_version_id = '00000000-0000-0000-0000-000000000031'
 where id = '00000000-0000-0000-0000-000000000021'
   and current_version_id is null;

-- 4. Backfill slug on the seeded WATonomous page if missing.
update public.pages
   set slug = 'watonomous'
 where id = '00000000-0000-0000-0000-000000000020' and slug is null;
