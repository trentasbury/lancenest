-- =====================================================================
-- LanceNest — core schema (Phase 1)
-- Run once in a FRESH Supabase project: SQL Editor -> New query -> Run.
--
-- Note on "users": Supabase Auth owns auth.users (email, password,
-- confirmation). public.profiles is the app-level user record, 1:1 with
-- auth.users, created automatically by the trigger at the bottom.
-- =====================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'veteran' check (role in ('veteran', 'employer', 'admin')),
  full_name text not null default '',
  username text unique,
  headline text,
  avatar_url text,
  location text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false);
$$;

create table public.veteran_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  about text,
  city text,
  state text,
  desired_titles text[] not null default '{}',
  industries text[] not null default '{}',
  work_arrangements text[] not null default '{}',
  employment_types text[] not null default '{}',
  salary_expectation integer check (salary_expectation is null or salary_expectation >= 0),
  willing_to_relocate boolean not null default false,
  clearance_level text not null default 'none'
    check (clearance_level in ('none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci')),
  verification_status text not null default 'not_verified'
    check (verification_status in ('not_verified', 'pending', 'verified', 'failed')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.can_view_veteran(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = target
      or public.is_admin()
      or public.app_role() = 'employer'
      or exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public);
$$;

-- ---------------------------------------------------------------------
-- Military service & the MOS -> civilian translation reference
-- ---------------------------------------------------------------------
create table public.military_occupations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  branch text not null
    check (branch in ('Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force')),
  title text not null,
  description text,
  civilian_categories text[] not null default '{}',
  civilian_skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (code, branch)
);
create index military_occupations_code_idx on public.military_occupations (lower(code));

create table public.military_service (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  branch text not null
    check (branch in ('Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force')),
  component text not null default 'active' check (component in ('active', 'reserve', 'guard')),
  rank text,
  occupation_code text,
  occupation_id uuid references public.military_occupations (id) on delete set null,
  start_date date,
  end_date date,
  deployments integer not null default 0 check (deployments >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index military_service_profile_idx on public.military_service (profile_id);

-- ---------------------------------------------------------------------
-- Skills, education, experience, certifications, resumes
-- ---------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'civilian'
    check (category in ('military', 'civilian', 'software', 'leadership')),
  created_at timestamptz not null default now()
);
create unique index skills_name_unique on public.skills (lower(name));

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);
create index profile_skills_skill_idx on public.profile_skills (skill_id);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school text not null,
  degree text,
  field text,
  graduation_year integer check (graduation_year is null or graduation_year between 1950 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index education_profile_idx on public.education (profile_id);

create table public.experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  position text not null,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index experience_profile_idx on public.experience (profile_id);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  issuer text,
  issued_on date,
  expires_on date,
  created_at timestamptz not null default now()
);
create index certifications_profile_idx on public.certifications (profile_id);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  -- Reserved for future resume parsing into profile fields.
  parsed_data jsonb,
  uploaded_at timestamptz not null default now()
);
create index resumes_profile_idx on public.resumes (profile_id);

-- ---------------------------------------------------------------------
-- Companies & jobs
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text not null unique,
  logo_url text,
  industry text,
  headquarters text,
  website text,
  about text,
  mission text,
  benefits text,
  veteran_commitment text,
  is_verified boolean not null default false,
  plan text not null default 'free' check (plan in ('free', 'professional', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_owner_idx on public.companies (owner_id);

create or replace function public.owns_company(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = target and c.owner_id = auth.uid());
$$;

create table public.company_followers (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);
create index company_followers_profile_idx on public.company_followers (profile_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  slug text not null unique,
  title text not null,
  department text,
  location text,
  work_arrangement text not null default 'onsite' check (work_arrangement in ('remote', 'hybrid', 'onsite')),
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'internship', 'skillbridge')),
  experience_level text check (experience_level in ('entry', 'mid', 'senior', 'executive')),
  industry text,
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer check (salary_max is null or salary_max >= 0),
  salary_period text not null default 'year' check (salary_period in ('year', 'hour')),
  description text not null default '',
  responsibilities text,
  qualifications text,
  preferred_qualifications text,
  benefits text,
  veteran_preferred boolean not null default false,
  military_transferable boolean not null default true,
  clearance_required text not null default 'none'
    check (clearance_required in ('none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci')),
  clearance_eligible boolean not null default false,
  status text not null default 'open' check (status in ('draft', 'open', 'paused', 'closed')),
  is_featured boolean not null default false,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);
create index jobs_status_posted_idx on public.jobs (status, posted_at desc);
create index jobs_company_idx on public.jobs (company_id);

create or replace function public.owns_job(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.jobs j join public.companies c on c.id = j.company_id
    where j.id = target and c.owner_id = auth.uid()
  );
$$;

create table public.job_skills (
  job_id uuid not null references public.jobs (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  primary key (job_id, skill_id)
);
create index job_skills_skill_idx on public.job_skills (skill_id);

create table public.saved_jobs (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, job_id)
);
create index saved_jobs_job_idx on public.saved_jobs (job_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'applied'
    check (status in ('saved', 'applied', 'viewed', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes text,
  interview_at timestamptz,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, profile_id)
);
create index applications_profile_idx on public.applications (profile_id);
create index applications_job_idx on public.applications (job_id);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  status text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index application_history_app_idx on public.application_status_history (application_id);

-- Every status change is recorded automatically.
create or replace function public.log_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_status_history (application_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

-- Stored, explainable match scores (Phase 6 fills this in).
create table public.job_matches (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  factors jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (profile_id, job_id)
);
create index job_matches_profile_score_idx on public.job_matches (profile_id, score desc);

create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  keywords text,
  location text,
  salary_min integer,
  work_arrangement text check (work_arrangement in ('remote', 'hybrid', 'onsite')),
  industry text,
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index job_alerts_profile_idx on public.job_alerts (profile_id);

-- ---------------------------------------------------------------------
-- Messaging & notifications
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
create index conversation_participants_profile_idx on public.conversation_participants (profile_id);

create or replace function public.is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conv and p.profile_id = auth.uid()
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  attachment_path text,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------------
-- Verification, subscriptions, moderation
-- ---------------------------------------------------------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  -- 'manual' today; a third-party provider can be added later.
  method text not null default 'manual',
  document_path text,
  notes text,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index verification_requests_status_idx on public.verification_requests (status, created_at);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'professional', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_company_idx on public.subscriptions (company_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('job', 'company', 'profile', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'fraud', 'inappropriate', 'fake_job', 'harassment', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger veteran_profiles_updated before update on public.veteran_profiles for each row execute function public.set_updated_at();
create trigger military_service_updated before update on public.military_service for each row execute function public.set_updated_at();
create trigger education_updated before update on public.education for each row execute function public.set_updated_at();
create trigger experience_updated before update on public.experience for each row execute function public.set_updated_at();
create trigger companies_updated before update on public.companies for each row execute function public.set_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function public.set_updated_at();
create trigger applications_updated before update on public.applications for each row execute function public.set_updated_at();
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger applications_status_log after insert or update on public.applications
  for each row execute function public.log_application_status();

-- ---------------------------------------------------------------------
-- New user -> profile (runs on signup, so a profile always exists).
-- Role comes from signup metadata but can NEVER be 'admin' this way.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  safe_role text := case when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer' else 'veteran' end;
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  base_slug text;
begin
  base_slug := trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'member'; end if;

  insert into public.profiles (id, role, full_name, username)
  values (new.id, safe_role, display_name, base_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6));

  if safe_role = 'veteran' then
    insert into public.veteran_profiles (profile_id) values (new.id);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Admin writes happen server-side with the service role after a
-- server-side role check, so user-session policies stay narrow.
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.veteran_profiles enable row level security;
alter table public.military_occupations enable row level security;
alter table public.military_service enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.education enable row level security;
alter table public.experience enable row level security;
alter table public.certifications enable row level security;
alter table public.resumes enable row level security;
alter table public.companies enable row level security;
alter table public.company_followers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.job_matches enable row level security;
alter table public.job_alerts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;

-- Profiles: signed-in members see each other; anyone sees public veterans.
create policy profiles_select_members on public.profiles for select to authenticated using (true);
create policy profiles_select_public on public.profiles for select to anon using (public.can_view_veteran(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy veteran_profiles_select on public.veteran_profiles for select using (public.can_view_veteran(profile_id));
create policy veteran_profiles_update_own on public.veteran_profiles for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Reference data
create policy military_occupations_read on public.military_occupations for select using (true);
create policy skills_read on public.skills for select using (true);
create policy skills_insert on public.skills for insert to authenticated with check (true);

-- Veteran-owned records: owner writes; visibility follows the veteran profile.
create policy military_service_select on public.military_service for select using (public.can_view_veteran(profile_id));
create policy military_service_write on public.military_service for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy profile_skills_select on public.profile_skills for select using (public.can_view_veteran(profile_id));
create policy profile_skills_write on public.profile_skills for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy education_select on public.education for select using (public.can_view_veteran(profile_id));
create policy education_write on public.education for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy experience_select on public.experience for select using (public.can_view_veteran(profile_id));
create policy experience_write on public.experience for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy certifications_select on public.certifications for select using (public.can_view_veteran(profile_id));
create policy certifications_write on public.certifications for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Resumes: owner only. Employers get time-limited signed URLs server-side.
create policy resumes_owner on public.resumes for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Companies: public pages; employers manage their own.
create policy companies_read on public.companies for select using (true);
create policy companies_insert_employer on public.companies for insert to authenticated
  with check (owner_id = auth.uid() and public.app_role() = 'employer');
create policy companies_update_owner on public.companies for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy company_followers_read on public.company_followers for select to authenticated using (true);
create policy company_followers_own on public.company_followers for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Jobs: open jobs are public; companies manage their own.
create policy jobs_read on public.jobs for select
  using (status = 'open' or public.owns_company(company_id) or public.is_admin());
create policy jobs_insert_owner on public.jobs for insert to authenticated
  with check (public.owns_company(company_id));
create policy jobs_update_owner on public.jobs for update to authenticated
  using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy jobs_delete_owner on public.jobs for delete to authenticated
  using (public.owns_company(company_id));

create policy job_skills_read on public.job_skills for select using (true);
create policy job_skills_write on public.job_skills for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));

create policy saved_jobs_own on public.saved_jobs for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Applications: applicant + the hiring company can see; applicant can only
-- apply or withdraw, the company moves it through the pipeline.
create policy applications_select on public.applications for select to authenticated
  using (profile_id = auth.uid() or public.owns_job(job_id) or public.is_admin());
create policy applications_insert_own on public.applications for insert to authenticated
  with check (profile_id = auth.uid() and status = 'applied' and public.app_role() = 'veteran');
create policy applications_update on public.applications for update to authenticated
  using (profile_id = auth.uid() or public.owns_job(job_id))
  with check ((profile_id = auth.uid() and status in ('applied', 'withdrawn')) or public.owns_job(job_id));

create policy application_history_select on public.application_status_history for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and (a.profile_id = auth.uid() or public.owns_job(a.job_id) or public.is_admin())
  ));

create policy job_matches_own on public.job_matches for select to authenticated using (profile_id = auth.uid());
create policy job_alerts_own on public.job_alerts for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Messaging (UI arrives in Phase 5; rules are in place now).
create policy conversations_participant on public.conversations for select to authenticated using (public.is_participant(id));
create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id));
create policy participants_update_own on public.conversation_participants for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy messages_select on public.messages for select to authenticated using (public.is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

create policy notifications_own_select on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy verification_select on public.verification_requests for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy verification_insert_own on public.verification_requests for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending');

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.owns_company(company_id) or public.is_admin());

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create policy admin_actions_admin on public.admin_actions for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Column-level protection: users can never grant themselves admin,
-- verified status, a paid plan, or a featured listing.
-- ---------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, username, headline, avatar_url, location, onboarding_completed)
  on public.profiles to authenticated;

revoke insert, update on public.veteran_profiles from anon, authenticated;
grant update (about, city, state, desired_titles, industries, work_arrangements, employment_types,
  salary_expectation, willing_to_relocate, clearance_level, is_public)
  on public.veteran_profiles to authenticated;

revoke insert, update on public.companies from anon, authenticated;
grant insert (owner_id, name, slug, logo_url, industry, headquarters, website, about, mission, benefits, veteran_commitment)
  on public.companies to authenticated;
grant update (name, logo_url, industry, headquarters, website, about, mission, benefits, veteran_commitment)
  on public.companies to authenticated;

revoke insert, update on public.jobs from anon, authenticated;
grant insert (company_id, slug, title, department, location, work_arrangement, employment_type, experience_level,
  industry, salary_min, salary_max, salary_period, description, responsibilities, qualifications,
  preferred_qualifications, benefits, veteran_preferred, military_transferable, clearance_required,
  clearance_eligible, status)
  on public.jobs to authenticated;
grant update (slug, title, department, location, work_arrangement, employment_type, experience_level,
  industry, salary_min, salary_max, salary_period, description, responsibilities, qualifications,
  preferred_qualifications, benefits, veteran_preferred, military_transferable, clearance_required,
  clearance_eligible, status)
  on public.jobs to authenticated;

revoke update on public.applications from anon, authenticated;
grant update (status, notes, interview_at) on public.applications to authenticated;

-- =====================================================================
-- STORAGE buckets (avatars/logos public; resumes & verification docs private)
-- Files live under a folder named after the uploader's user id.
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('company-logos', 'company-logos', true),
  ('resumes', 'resumes', false),
  ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy lancenest_public_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'company-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy lancenest_public_uploads_update on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'company-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy lancenest_public_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'company-logos') and (storage.foldername(name))[1] = auth.uid()::text);

create policy lancenest_private_docs_select on storage.objects for select to authenticated
  using (bucket_id in ('resumes', 'verification-docs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy lancenest_private_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('resumes', 'verification-docs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy lancenest_private_docs_delete on storage.objects for delete to authenticated
  using (bucket_id in ('resumes', 'verification-docs') and (storage.foldername(name))[1] = auth.uid()::text);
