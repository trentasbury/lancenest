-- =====================================================================
-- LanceNest — Transition hub + DoD SkillBridge
-- Only DoD-authorized organizations (skillbridge.osd.mil) may publish
-- SkillBridge listings; LanceNest admins confirm authorization.
-- =====================================================================
alter table public.veteran_profiles add column if not exists separation_date date;
alter table public.veteran_profiles add column if not exists open_to_transition_hiring boolean not null default false;
alter table public.veteran_profiles add column if not exists skillbridge_interest boolean not null default false;
grant update (separation_date, open_to_transition_hiring, skillbridge_interest) on public.veteran_profiles to authenticated;
create index if not exists veteran_profiles_transition_idx on public.veteran_profiles (separation_date) where open_to_transition_hiring;

alter table public.companies add column if not exists skillbridge_status text not null default 'none';
alter table public.companies drop constraint if exists companies_skillbridge_status_check;
alter table public.companies add constraint companies_skillbridge_status_check check (skillbridge_status in ('none', 'pending', 'authorized', 'rejected'));
alter table public.companies add column if not exists skillbridge_org_name text;
alter table public.companies add column if not exists skillbridge_note text;

alter table public.jobs add column if not exists skillbridge_weeks integer check (skillbridge_weeks is null or skillbridge_weeks between 1 and 26);
grant insert (skillbridge_weeks) on public.jobs to authenticated;
grant update (skillbridge_weeks) on public.jobs to authenticated;

-- SkillBridge listings: only DoD-authorized companies, and never with a salary (DoD pays participants).
create or replace function private.skillbridge_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.employment_type <> 'skillbridge' then return new; end if;
  new.salary_min := null; new.salary_max := null;
  if auth.uid() is not null and new.status = 'open'
     and not exists (select 1 from public.companies c where c.id = new.company_id and c.skillbridge_status = 'authorized') then
    raise exception 'skillbridge_unauthorized' using errcode = 'P0007', hint = 'Only DoD-authorized SkillBridge organizations can publish SkillBridge programs.';
  end if;
  return new;
end $$;
revoke execute on function private.skillbridge_rules() from public, anon, authenticated;
drop trigger if exists jobs_skillbridge_rules on public.jobs;
create trigger jobs_skillbridge_rules before insert or update on public.jobs for each row execute function private.skillbridge_rules();
