-- =====================================================================
-- Private first-party analytics (no cookies; anonymous visitor codes rotate
-- daily) + member activity, for the admin Insights dashboard.
-- =====================================================================
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null check (char_length(path) <= 300),
  visitor text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  referrer_host text,
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);
alter table public.page_views enable row level security;   -- no policies: written/read by the server only

alter table public.profiles add column if not exists last_active_at timestamptz;
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);

-- One call returns every number the dashboard needs (service role only).
create or replace function public.admin_traffic_stats()
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'views_today', (select count(*) from page_views where created_at >= date_trunc('day', now())),
    'views_7d', (select count(*) from page_views where created_at >= now() - interval '7 days'),
    'views_30d', (select count(*) from page_views where created_at >= now() - interval '30 days'),
    'visitors_today', (select count(distinct visitor) from page_views where created_at >= date_trunc('day', now())),
    'avg_daily_visitors_7d', (select round(count(distinct (visitor, created_at::date))::numeric / 7, 1) from page_views where created_at >= now() - interval '7 days'),
    'active_24h', (select count(*) from profiles where last_active_at >= now() - interval '1 day'),
    'active_7d', (select count(*) from profiles where last_active_at >= now() - interval '7 days'),
    'active_30d', (select count(*) from profiles where last_active_at >= now() - interval '30 days'),
    'members', (select json_build_object(
        'veterans', count(*) filter (where p.role = 'veteran'),
        'verified', count(*) filter (where p.role = 'veteran' and p.verified),
        'employers', count(*) filter (where p.role = 'employer'))
      from profiles p join auth.users u on u.id = p.id
      where not p.banned and coalesce(u.raw_app_meta_data ->> 'demo', '') <> 'true'),
    'signups_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days' and coalesce(raw_app_meta_data ->> 'demo', '') <> 'true'),
    'top_pages', (select coalesce(json_agg(t), '[]') from (select path, count(*) as views from page_views where created_at >= now() - interval '7 days' group by path order by views desc limit 8) t),
    'top_referrers', (select coalesce(json_agg(t), '[]') from (select referrer_host as host, count(*) as views from page_views where created_at >= now() - interval '30 days' and referrer_host is not null group by referrer_host order by views desc limit 6) t),
    'daily', (select coalesce(json_agg(t order by day), '[]') from (select created_at::date as day, count(*) as views, count(distinct visitor) as visitors from page_views where created_at >= now() - interval '14 days' group by 1) t)
  );
$$;
revoke execute on function public.admin_traffic_stats() from public, anon, authenticated;
grant execute on function public.admin_traffic_stats() to service_role;
