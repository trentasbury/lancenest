-- =====================================================================
-- Veteran paid plans: billing, profile views (who viewed you), profile
-- boosts, featured placement, and 48-hour early access to cleared roles.
-- =====================================================================
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in
  ('free', 'professional', 'federal', 'enterprise', 'veteran_pro', 'veteran_pro_plus', 'veteran_federal_pro', 'job_slot'));

-- Stripe customer ids for members live in a server-only table (never on a profile other people can read).
create table if not exists public.billing_customers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;

alter table public.veteran_profiles add column if not exists boosted_until timestamptz;
create table if not exists public.profile_boosts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists profile_boosts_idx on public.profile_boosts (profile_id, created_at desc);
alter table public.profile_boosts enable row level security;
drop policy if exists profile_boosts_own on public.profile_boosts;
create policy profile_boosts_own on public.profile_boosts for select to authenticated using (profile_id = auth.uid());

-- Who viewed you: paid members can read their viewers; everyone can read their own count.
drop policy if exists profile_views_owner_paid on public.profile_views;
create policy profile_views_owner_paid on public.profile_views for select to authenticated
  using (profile_id = auth.uid() and exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan <> 'free'));
create or replace function public.my_profile_view_count(days integer)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.profile_views
   where profile_id = auth.uid() and viewed_at >= now() - make_interval(days => least(greatest(days, 1), 365));
$$;
revoke execute on function public.my_profile_view_count(integer) from public, anon;
grant execute on function public.my_profile_view_count(integer) to authenticated;

-- Federal members see jobs requiring a clearance 48 hours before other service members.
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated
  using ((status = 'open' and private.is_verified_member()
          and (coalesce(clearance_required, 'none') = 'none'
               or posted_at <= now() - interval '48 hours'
               or private.app_role() <> 'veteran'
               or exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan = 'federal_pro')))
         or private.owns_company(company_id) or private.is_admin());
