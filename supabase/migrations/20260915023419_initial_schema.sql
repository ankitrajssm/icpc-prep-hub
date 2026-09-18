-- ICPC Prep Hub — initial schema
--
-- Managed via the Supabase CLI (see supabase/config.toml and README § Cloud sync
-- setup). Apply it either by running `supabase db push` (recommended — this is how
-- future migrations get applied too), or by pasting this file's contents into your
-- project's SQL Editor -> New query and running it once, if you'd rather not install
-- the CLI.
--
-- It creates one table (`profiles`) holding the same JSON shape the app already uses in
-- localStorage, keyed by the authenticated user's id, plus row-level security so each
-- user can only ever read/write their own row.
--
-- Design note: we deliberately store the app's state as one JSONB blob per user rather
-- than normalizing into many tables. Every *private* read here is "give me my own
-- data" — no per-field querying across users — so a relational schema would add
-- migration/maintenance overhead without buying anything. A feature that needs public,
-- cross-user data (e.g. a top-CF-users leaderboard) is a different shape entirely
-- (public-read table, backend-only writes) and belongs in its own migration file
-- alongside this one, not folded into `profiles`.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  cf_handle text,
  cf_verified boolean not null default false,
  app_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a blank profile row whenever a new auth user signs up, so the app never
-- has to worry about a missing row on first login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, app_data)
  values (new.id, '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
