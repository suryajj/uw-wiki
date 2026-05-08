-- =====================================================================
-- FRD-1 RAG Search RPC Functions
-- Adds RPCs for pgvector semantic search and PostgreSQL full-text keyword
-- search. The `chunks` table itself is created by FRD-0.
-- =====================================================================

create or replace function public.match_chunks_semantic(
  query_embedding extensions.vector(512),
  match_count integer default 20,
  university_filter uuid default null
)
returns table (
  id uuid,
  content_text text,
  org_name text,
  org_slug text,
  section_title text,
  section_slug text,
  chunk_type text,
  category text,
  anchored_section text,
  references_previous_version boolean,
  created_at timestamptz,
  similarity_score double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.content_text,
    c.org_name,
    c.org_slug,
    c.section_title,
    c.section_slug,
    c.chunk_type,
    c.category,
    c.anchored_section,
    c.references_previous_version,
    c.created_at,
    1 - (c.embedding <=> query_embedding) as similarity_score
  from public.chunks c
  where (university_filter is null or c.university_id = university_filter)
    and not exists (
      select 1
      from public.comments hidden_comments
      where hidden_comments.id = c.source_comment_id
        and hidden_comments.is_hidden = true
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_chunks_keyword(
  query_text text,
  match_count integer default 20,
  university_filter uuid default null
)
returns table (
  id uuid,
  content_text text,
  org_name text,
  org_slug text,
  section_title text,
  section_slug text,
  chunk_type text,
  category text,
  anchored_section text,
  references_previous_version boolean,
  created_at timestamptz,
  rank_score real
)
language sql
stable
set search_path = public, extensions
as $$
  with search_query as (
    select plainto_tsquery('english', query_text) as tsq
  )
  select
    c.id,
    c.content_text,
    c.org_name,
    c.org_slug,
    c.section_title,
    c.section_slug,
    c.chunk_type,
    c.category,
    c.anchored_section,
    c.references_previous_version,
    c.created_at,
    ts_rank_cd(c.content_tsvector, search_query.tsq) as rank_score
  from public.chunks c, search_query
  where c.content_tsvector @@ search_query.tsq
    and (university_filter is null or c.university_id = university_filter)
    and not exists (
      select 1
      from public.comments hidden_comments
      where hidden_comments.id = c.source_comment_id
        and hidden_comments.is_hidden = true
    )
  order by rank_score desc
  limit match_count;
$$;
