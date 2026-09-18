-- Codeforces baseline data: server-synced, real-player-sampled tier statistics.
--
-- Replaces the old "regenerate a static file by hand" approach with a daily background
-- job (see supabase/functions/sync-cf-baseline). Three tables:
--
--   cf_baseline_data      — the PUBLISHED result the app actually reads. Public read
--                           (it's not per-user data), writes only via the service role
--                           (used internally by the sync Edge Function).
--   cf_percentiles        — the rating -> "top p%" lookup table, refreshed alongside.
--                           Same read/write shape as cf_baseline_data.
--   cf_baseline_sync_state — internal job bookkeeping for the incremental batch sync
--                           (which tier it's on, which handles are left to fetch this
--                           phase, what's been accumulated so far). Not readable by
--                           anyone but the service role — it's not app data, just the
--                           sync job's own progress tracker between cron-triggered runs.

create table if not exists public.cf_baseline_data (
  tier text primary key,
  label text not null,
  rating_cutoff integer,
  windows jsonb not null, -- { allTime: {problemCount, tagRatios, sampleSize}, lastYear: {...} }
  updated_at timestamptz not null default now()
);

alter table public.cf_baseline_data enable row level security;

drop policy if exists "Anyone can read baseline data" on public.cf_baseline_data;
create policy "Anyone can read baseline data"
  on public.cf_baseline_data for select
  using (true);
-- No insert/update/delete policy for anon/authenticated — only the service role writes here.

create table if not exists public.cf_percentiles (
  id boolean primary key default true,
  percentiles jsonb not null, -- { "1": 2108, "2": 1947, ... } — rating cutoff for "top p%"
  updated_at timestamptz not null default now(),
  constraint cf_percentiles_singleton check (id)
);

alter table public.cf_percentiles enable row level security;

drop policy if exists "Anyone can read percentiles" on public.cf_percentiles;
create policy "Anyone can read percentiles"
  on public.cf_percentiles for select
  using (true);

create table if not exists public.cf_baseline_sync_state (
  id boolean primary key default true,
  phase text not null default 'idle', -- 'idle' | 'top500' | 'top10000' | 'average'
  pool jsonb not null default '[]'::jsonb, -- handles still to fetch this phase
  accumulated jsonb not null default '[]'::jsonb, -- per-user window results collected so far this phase
  cutoff500 integer,
  cutoff10000 integer,
  median_rating integer,
  updated_at timestamptz not null default now(),
  constraint cf_baseline_sync_state_singleton check (id)
);

alter table public.cf_baseline_sync_state enable row level security;
-- Deliberately no policies at all here — default-deny for anon/authenticated. Only the
-- service role (which bypasses RLS entirely) touches this table.
