-- =====================================================================
-- Perks release 2: team seats, job alerts (paid members), saved-search
-- alerts (paid employers). Ownership helpers now include team members.
-- =====================================================================
create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);
alter table public.company_members enable row level security;
drop policy if exists company_members_read on public.company_members;
create policy company_members_read on public.company_members for select to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()) or private.is_admin());

-- Team members act for the company everywhere these helpers are used (jobs, applicants, candidates, talent pools…).
create or replace function private.owns_company(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = target and c.owner_id = auth.uid())
      or exists (select 1 from public.company_members m where m.company_id = target and m.profile_id = auth.uid());
$$;
create or replace function private.owns_job(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs j where j.id = target and private.owns_company(j.company_id));
$$;

create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (select 1 from public.companies c where private.owns_company(c.id) and c.is_verified and c.plan in ('professional', 'federal', 'enterprise'))
          and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id where a.profile_id = target and private.owns_company(j.company_id))
      or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id where pr.freelancer_id = target and fp.client_id = auth.uid())
      or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
                 where p1.profile_id = auth.uid() and p2.profile_id = target);
$$;

drop policy if exists resumes_employer_read on public.resumes;
create policy resumes_employer_read on public.resumes for select to authenticated
  using ((private.app_role() = 'employer' and private.is_verified_member()
          and exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                      where a.resume_id = resumes.id and private.owns_company(c.id) and c.is_verified and a.status <> 'withdrawn'))
         or private.is_admin());

drop policy if exists projects_insert on public.freelance_projects;
create policy projects_insert on public.freelance_projects for insert to authenticated
  with check (client_id = auth.uid() and private.app_role() = 'employer' and private.owns_company(company_id)
              and exists (select 1 from public.companies c where c.id = company_id and c.is_verified));

-- Seats (owner included): Free 1, Professional 2, Federal 5, Enterprise 20.
create or replace function private.seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer; used integer;
begin
  select case plan when 'professional' then 2 when 'federal' then 5 when 'enterprise' then 20 else 1 end into cap from public.companies where id = new.company_id;
  select 1 + count(*) into used from public.company_members where company_id = new.company_id;
  if used >= cap then raise exception 'seat_limit' using errcode = 'P0013'; end if;
  return new;
end $$;
revoke execute on function private.seat_limit() from public, anon, authenticated;
drop trigger if exists company_members_seats on public.company_members;
create trigger company_members_seats before insert on public.company_members for each row execute function private.seat_limit();

-- Job alerts for paid members (Pro 3, Pro Plus 5, Federal 10). Replaces an unused, empty table from the original schema.
drop table if exists public.job_alerts cascade;
create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  keywords text check (char_length(keywords) <= 120),
  state text check (state is null or char_length(state) <= 5),
  arrangement text check (arrangement is null or arrangement in ('remote', 'hybrid', 'onsite')),
  cleared_only boolean not null default false,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
alter table public.job_alerts enable row level security;
drop policy if exists job_alerts_own on public.job_alerts;
create policy job_alerts_own on public.job_alerts for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan <> 'free'));
revoke update on public.job_alerts from anon, authenticated;

create or replace function private.alert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer;
begin
  select case plan when 'federal_pro' then 10 when 'pro_plus' then 5 when 'pro' then 3 else 0 end into cap from public.veteran_profiles where profile_id = new.profile_id;
  if (select count(*) from public.job_alerts where profile_id = new.profile_id) >= coalesce(cap, 0) then raise exception 'alert_limit' using errcode = 'P0014'; end if;
  if new.cleared_only and not exists (select 1 from public.veteran_profiles where profile_id = new.profile_id and plan = 'federal_pro') then new.cleared_only := false; end if;
  return new;
end $$;
revoke execute on function private.alert_limit() from public, anon, authenticated;
drop trigger if exists job_alerts_limit on public.job_alerts;
create trigger job_alerts_limit before insert on public.job_alerts for each row execute function private.alert_limit();

-- Saved candidate searches with alerts for paid employers (10 per company).
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  params jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_own on public.saved_searches;
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (private.owns_company(company_id))
  with check (private.owns_company(company_id) and (select count(*) from public.saved_searches s where s.company_id = saved_searches.company_id) < 10
              and exists (select 1 from public.companies c where c.id = company_id and c.plan in ('professional', 'federal', 'enterprise')));
revoke update on public.saved_searches from anon, authenticated;

-- Which company a user represents (owner or team member) — used to show "recruiting for …" in messages.
create or replace function public.company_for_user(u uuid)
returns table (name text, is_verified boolean) language sql stable security definer set search_path = public as $$
  select c.name, c.is_verified from public.companies c
   where c.owner_id = u or exists (select 1 from public.company_members m where m.company_id = c.id and m.profile_id = u)
   limit 1;
$$;
revoke execute on function public.company_for_user(uuid) from public, anon, authenticated;
grant execute on function public.company_for_user(uuid) to service_role;
