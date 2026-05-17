-- 012_program_pulse_metrics.sql
-- Widen the pulse metric CHECK constraints so Academic Programs can record
-- program-specific metrics (workload, employability, community) in place of
-- the club metrics (selectivity, vibe_check, coop_boost). `tech_stack` was
-- already removed from the app surface and is excluded here.
--
-- Per-category metric enforcement (clubs vs. programs) is handled at the API
-- layer (src/app/api/pulse/vote/route.ts) where we have access to
-- organizations.category.
--
-- Notes for whoever debugs this later:
--   * The base table is `pulse_ratings` (per-user vote rows) and the rollup
--     is `pulse_aggregates`. There is NO `pulse_votes` table — that name was
--     used in an earlier draft and is wrong.
--   * The original CHECK constraints (see migration 001) were declared
--     inline, so Postgres auto-named them. The default name is
--     `<table>_<column>_check`, but to be safe we discover and drop ALL
--     CHECK constraints on the `metric` column of each table before adding
--     the new one. That way this migration is idempotent and survives a
--     repo where someone earlier renamed the constraint manually.

-- Step 1: purge any legacy rows whose `metric` is not in the new whitelist.
-- In practice this means `tech_stack` aggregates/votes that pre-date the
-- removal of that metric from the app surface. Without this purge, the
-- ADD CONSTRAINT below fails with 23514 "violated by some row".
--
-- This is a destructive operation, but `tech_stack` is unreachable from the
-- UI and not surfaced anywhere — deleting its rows is the intended outcome.
delete from public.pulse_aggregates
  where metric not in (
    'selectivity', 'vibe_check', 'coop_boost',
    'workload', 'employability', 'community'
  );

delete from public.pulse_ratings
  where metric not in (
    'selectivity', 'vibe_check', 'coop_boost',
    'workload', 'employability', 'community'
  );

do $$
declare
  cons_name text;
begin
  for cons_name in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema   = tc.table_schema
    where tc.constraint_type = 'CHECK'
      and tc.table_schema    = 'public'
      and tc.table_name      = 'pulse_ratings'
      and ccu.column_name    = 'metric'
  loop
    execute format(
      'alter table public.pulse_ratings drop constraint %I',
      cons_name
    );
  end loop;

  for cons_name in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema   = tc.table_schema
    where tc.constraint_type = 'CHECK'
      and tc.table_schema    = 'public'
      and tc.table_name      = 'pulse_aggregates'
      and ccu.column_name    = 'metric'
  loop
    execute format(
      'alter table public.pulse_aggregates drop constraint %I',
      cons_name
    );
  end loop;
end$$;

alter table public.pulse_ratings
  add constraint pulse_ratings_metric_check
  check (metric in (
    'selectivity',
    'vibe_check',
    'coop_boost',
    'workload',
    'employability',
    'community'
  ));

alter table public.pulse_aggregates
  add constraint pulse_aggregates_metric_check
  check (metric in (
    'selectivity',
    'vibe_check',
    'coop_boost',
    'workload',
    'employability',
    'community'
  ));
