-- =====================================================================
-- LanceNest — employer perks & LinkedIn-style gating
-- Free employers see only candidates who applied to them or share a
-- conversation with them. Paid plans unlock every veteran profile.
-- =====================================================================
alter table public.companies add column if not exists contact_credits integer not null default 0;

create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.plan in ('professional', 'federal', 'enterprise'))
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                 where a.profile_id = target and c.owner_id = auth.uid())
      or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
                 where p1.profile_id = auth.uid() and p2.profile_id = target);
$$;

create or replace function private.can_view_veteran(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = target
      or private.is_admin()
      or exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public)
      or (private.app_role() = 'employer' and private.employer_can_see(target));
$$;

-- Who an employer has contacted first (each veteran counts once).
create table if not exists public.employer_contacts (
  company_id uuid not null references public.companies (id) on delete cascade,
  veteran_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('allowance', 'credit')),
  created_at timestamptz not null default now(),
  primary key (company_id, veteran_id)
);
create index if not exists employer_contacts_month_idx on public.employer_contacts (company_id, created_at);
alter table public.employer_contacts enable row level security;
create policy employer_contacts_read on public.employer_contacts for select to authenticated using (private.owns_company(company_id));

-- Job analytics: one view per member per job per day.
create table if not exists public.job_views (
  job_id uuid not null references public.jobs (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  primary key (job_id, viewer_id, viewed_on)
);
create index if not exists job_views_job_idx on public.job_views (job_id, viewed_on);
alter table public.job_views enable row level security;
create policy job_views_insert on public.job_views for insert to authenticated with check (viewer_id = auth.uid());
create policy job_views_read on public.job_views for select to authenticated using (private.owns_job(job_id) or private.is_admin());

-- Profile views (powers the veteran Pro "who viewed your profile" perk).
create table if not exists public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, viewer_id, viewed_on),
  check (profile_id <> viewer_id)
);
create index if not exists profile_views_profile_idx on public.profile_views (profile_id, viewed_at desc);
alter table public.profile_views enable row level security;
create policy profile_views_insert on public.profile_views for insert to authenticated with check (viewer_id = auth.uid());

-- Notify the employer when someone applies, and the applicant when their status changes.
create or replace function private.on_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; job_title text;
begin
  select c.owner_id, j.title into owner, job_title from public.jobs j join public.companies c on c.id = j.company_id where j.id = new.job_id;
  if tg_op = 'INSERT' then
    perform private.notify(owner, new.profile_id, 'application', 'applied to ' || job_title, '/employer/jobs/' || new.job_id || '/applicants');
  elsif new.status is distinct from old.status and auth.uid() is not null and auth.uid() <> new.profile_id then
    perform private.notify(new.profile_id, auth.uid(), 'application_status', 'moved your application for ' || job_title || ' to “' || initcap(new.status) || '”', '/dashboard');
  end if;
  return null;
end $$;
revoke execute on function private.on_application_change() from public, anon, authenticated;
drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert or update of status on public.applications
  for each row execute function private.on_application_change();
