-- =====================================================================
-- LanceNest — company verification (DB-enforced) + full-text job search
-- =====================================================================
alter table public.companies add column if not exists verification_status text not null default 'unverified';
alter table public.companies drop constraint if exists companies_verification_status_check;
alter table public.companies add constraint companies_verification_status_check
  check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
alter table public.companies add column if not exists verification_details jsonb;
alter table public.companies add column if not exists verification_note text;
update public.companies set verification_status = case when is_verified then 'verified' else 'unverified' end
  where verification_status = 'unverified';
create index if not exists companies_verification_idx on public.companies (verification_status, updated_at);

-- Only verified companies can publish jobs.
create or replace function private.require_verified_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  if not exists (select 1 from public.companies c where c.id = new.company_id and c.is_verified) then
    raise exception 'company_unverified' using errcode = 'P0004', hint = 'Your company must be verified before jobs can be published.';
  end if;
  return new;
end $$;
revoke execute on function private.require_verified_company() from public, anon, authenticated;
drop trigger if exists jobs_require_verified_company on public.jobs;
create trigger jobs_require_verified_company before insert or update of status on public.jobs
  for each row execute function private.require_verified_company();

-- Candidate discovery requires a VERIFIED company on a paid plan.
create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.is_verified and c.plan in ('professional', 'federal', 'enterprise'))
          and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                 where a.profile_id = target and c.owner_id = auth.uid())
      or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
                 where p1.profile_id = auth.uid() and p2.profile_id = target);
$$;

-- Full-text job search (ranked, handles phrases, "or", and -exclusions).
alter table public.jobs add column if not exists search tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(industry, '') || ' ' || coalesce(department, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(qualifications, '') || ' ' || coalesce(responsibilities, '')), 'C')
) stored;
create index if not exists jobs_search_idx on public.jobs using gin (search);
