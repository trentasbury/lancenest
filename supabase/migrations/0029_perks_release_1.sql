-- =====================================================================
-- Perks release 1: early-applicant tag, applicant insights (paid members),
-- talent pools (paid employers), company branding (cover photo).
-- =====================================================================
-- Jobs with fewer than 10 applicants (no counts are ever revealed to job seekers).
create or replace function public.early_jobs(ids uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select j.id from public.jobs j
   where j.id = any(ids) and private.is_verified_member()
     and (select count(*) from public.applications a where a.job_id = j.id and a.source = 'lancenest' and a.status <> 'withdrawn') < 10;
$$;
revoke execute on function public.early_jobs(uuid[]) from public, anon;
grant execute on function public.early_jobs(uuid[]) to authenticated;

-- Applicant insights for paid members: how their skill match compares — percentages only, never raw counts.
create or replace function public.applicant_insight(j uuid)
returns table (stronger_than_pct integer, verified_pct integer, applicants_bucket text)
language sql stable security definer set search_path = public as $$
  with allowed as (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan <> 'free'),
  js as (select skill_id from public.job_skills where job_id = j),
  apps as (select a.profile_id from public.applications a where a.job_id = j and a.source = 'lancenest' and a.status <> 'withdrawn' and a.profile_id <> auth.uid()),
  scores as (select ap.profile_id, (select count(*) from public.profile_skills ps where ps.profile_id = ap.profile_id and ps.skill_id in (select skill_id from js)) as s from apps ap),
  me as (select count(*) as s from public.profile_skills ps where ps.profile_id = auth.uid() and ps.skill_id in (select skill_id from js))
  select
    case when (select count(*) from scores) = 0 then 100 else round(100.0 * (select count(*) from scores where s <= (select s from me)) / (select count(*) from scores))::integer end,
    coalesce(round(100.0 * (select count(*) from apps a join public.veteran_profiles v on v.profile_id = a.profile_id where v.verification_status = 'verified') / nullif((select count(*) from apps), 0))::integer, 0),
    case when (select count(*) from apps) < 10 then 'Fewer than 10' when (select count(*) from apps) < 50 then '10–50' else '50+' end
  where exists (select 1 from allowed);
$$;
revoke execute on function public.applicant_insight(uuid) from public, anon;
grant execute on function public.applicant_insight(uuid) to authenticated;

-- Talent pools: paid employers save candidates into named lists with private notes.
create table if not exists public.talent_pool_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  list_name text not null default 'Shortlist' check (char_length(list_name) between 1 and 60),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (company_id, profile_id, list_name)
);
alter table public.talent_pool_items enable row level security;
drop policy if exists talent_pool_own on public.talent_pool_items;
create policy talent_pool_own on public.talent_pool_items for all to authenticated
  using (private.owns_company(company_id))
  with check (private.owns_company(company_id) and exists (select 1 from public.companies c where c.id = company_id and c.plan in ('professional', 'federal', 'enterprise')));

-- Company branding: cover photo (set by the server after upload).
alter table public.companies add column if not exists cover_url text;
