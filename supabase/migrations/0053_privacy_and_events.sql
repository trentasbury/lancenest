-- 1) Members can hide their profile from specific companies (e.g. a current employer).
create table if not exists public.hidden_companies (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, company_id)
);
create index if not exists hidden_companies_company_idx on public.hidden_companies (company_id);
alter table public.hidden_companies enable row level security;
create policy hidden_companies_own on public.hidden_companies for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Is the signed-in employer (owner or team member) hidden by this member?
create or replace function private.hidden_from_viewer(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hidden_companies h where h.profile_id = target and private.owns_company(h.company_id));
$$;
-- Members who have hidden the signed-in employer's company (used to filter lists).
create or replace function public.members_hiding_me()
returns setof uuid language sql stable security definer set search_path = public as $$
  select h.profile_id from public.hidden_companies h where private.owns_company(h.company_id);
$$;
revoke execute on function public.members_hiding_me() from public, anon;
grant execute on function public.members_hiding_me() to authenticated;

-- Full profiles: never visible to a company the member has hidden.
create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not private.hidden_from_viewer(target) and (
    (exists (select 1 from public.companies c where private.owns_company(c.id) and c.is_verified and c.plan in ('professional', 'federal', 'enterprise'))
     and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))
    or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id where a.profile_id = target and private.owns_company(j.company_id))
    or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id where pr.freelancer_id = target and fp.client_id = auth.uid())
    or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
               where p1.profile_id = auth.uid() and p2.profile_id = target));
$$;

-- 2) Click tracking: page_views rows can carry a named event (e.g. cta_hire_veterans).
alter table public.page_views add column if not exists event text check (event is null or event ~ '^[a-z0-9_]{2,60}$');
create index if not exists page_views_event_idx on public.page_views (event, created_at desc) where event is not null;
