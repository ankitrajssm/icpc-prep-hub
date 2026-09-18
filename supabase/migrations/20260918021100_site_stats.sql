-- Drop the previous page_views table that we no longer need
drop table if exists public.page_views;

-- Create the new stats table
create table public.site_stats (
    id int primary key check (id = 1),
    total_views bigint not null default 0,
    authorized_views bigint not null default 0
);

-- Insert the single row that will hold the counters
insert into public.site_stats (id, total_views, authorized_views) values (1, 0, 0);

-- Enable RLS with no policies, meaning only admins can view the data from the dashboard
alter table public.site_stats enable row level security;

-- Create a secure function that the frontend can call to increment the counts
-- `security definer` allows the function to bypass RLS and update the table
create or replace function public.increment_page_view(is_authorized boolean)
returns void
language sql
security definer
as $$
    update public.site_stats
    set total_views = total_views + 1,
        authorized_views = authorized_views + (case when is_authorized then 1 else 0 end)
    where id = 1;
$$;
