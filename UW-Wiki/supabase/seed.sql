-- =====================================================================
-- FRD-0 Seed Data
-- Provides Waterloo university, lifecycle thresholds, and one sample
-- org with seeded Pulse aggregates so FRD-1 RAG exit criteria are runnable.
-- =====================================================================

-- 1. University: Waterloo
insert into public.universities (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'uw', 'University of Waterloo')
on conflict (slug) do nothing;

-- 2. Lifecycle thresholds (FRD-2 §9.2)
insert into public.lifecycle_config (category, needs_update_days, outdated_days) values
  ('Design Teams',           180, 365),
  ('Engineering Clubs',      180, 365),
  ('Non-Engineering Clubs',  180, 365),
  ('Academic Programs',      365, 730),
  ('Student Societies',      365, 730),
  ('Campus Organizations',   180, 365)
on conflict (category) do nothing;

-- 3. Sample organization (WATonomous) for FRD-1 RAG exit criterion #22
insert into public.organizations (id, university_id, org_slug, org_name, category, tagline, claimed_status)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'watonomous',
  'WATonomous',
  'Design Teams',
  'University of Waterloo''s autonomous vehicle research and design team.',
  'unclaimed'
)
on conflict (university_id, org_slug) do nothing;

-- 4. Sample page for the org
insert into public.pages (id, org_id, content_json, last_modified_at)
values (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Overview"}]},{"type":"paragraph","content":[{"type":"text","text":"WATonomous is an autonomous vehicle design team at the University of Waterloo, building self-driving software in ROS2, C++, and Python."}]}]}'::jsonb,
  now()
)
on conflict (org_id) do nothing;

-- 5. Pulse aggregates for the sample org
insert into public.pulse_aggregates (org_id, metric, aggregate_value, aggregate_label, total_votes) values
  ('00000000-0000-0000-0000-000000000010', 'selectivity', 'Application-Based', 'Application-Based', 34),
  ('00000000-0000-0000-0000-000000000010', 'vibe_check',  '2.8',                '2.8 / 5',                29),
  ('00000000-0000-0000-0000-000000000010', 'coop_boost',  '4.5',                '4.5 / 5',                31),
  ('00000000-0000-0000-0000-000000000010', 'tech_stack',  'ROS2, C++, Python, PyTorch, Docker', 'ROS2, C++, Python, PyTorch, Docker', 27)
on conflict (org_id, metric) do nothing;
