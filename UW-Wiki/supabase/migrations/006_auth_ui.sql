-- =====================================================================
-- FRD-6 Auth UI Migration
-- Adds display-name constraints, email verification mirror field, and a
-- richer auth.users sync trigger for public.users.
-- =====================================================================

alter table public.users
  add column if not exists email_verified_at timestamptz;

alter table public.users
  drop constraint if exists users_display_name_check;

alter table public.users
  add constraint users_display_name_check
  check (
    display_name is null
    or (
      char_length(display_name) between 2 and 50
      and display_name !~ '[<>]'
    )
  );

create index if not exists idx_users_role_created
  on public.users (role, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url, role, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', '')
    ),
    new.raw_user_meta_data->>'avatar_url',
    'user',
    new.email_confirmed_at
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.users.display_name, excluded.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        email_verified_at = excluded.email_verified_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();
