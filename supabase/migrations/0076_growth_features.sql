-- 0076: Features from the October 2026 competitive assessment. Additive only: new columns default to "off",
-- new tables are server-only (RLS on, no policies, no client grants), and the replaced functions keep their
-- old behavior apart from the changes noted.

-- 1) Employer plans: a $99 Starter plan (5 open jobs, 1 seat, no talent search).
alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies add constraint companies_plan_check check (plan in ('free', 'starter', 'professional', 'federal', 'enterprise'));
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'starter', 'professional', 'federal', 'enterprise',
  'veteran_pro', 'veteran_pro_plus', 'veteran_federal_pro', 'job_slot', 'training', 'training_featured'));

-- Open-job caps: Free 2, Starter 5, Professional 10. SkillBridge programs are free to post and never count.
create or replace function private.enforce_job_limit() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare
  c record;
  open_count integer;
  cap integer;
begin
  if auth.uid() is null or new.status <> 'open' or new.employment_type = 'skillbridge' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  select plan, extra_job_slots into c from public.companies where id = new.company_id;
  cap := case c.plan when 'free' then 2 when 'starter' then 5 when 'professional' then 10 else null end;
  if cap is not null then
    select count(*) into open_count from public.jobs
     where company_id = new.company_id and status = 'open' and id <> new.id and employment_type <> 'skillbridge';
    if open_count >= cap + coalesce(c.extra_job_slots, 0) then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'Open-job limit reached for this plan.';
    end if;
  end if;
  return new;
end $$;

-- 2) Employer badges: Military Spouse Employment Partnership (checked by an admin against the public partner list)
--    and a Guard & Reserve pledge (the employer's own commitment, shown with the ratings' support score).
alter table public.companies add column if not exists msep_status text not null default 'none'
  check (msep_status in ('none', 'pending', 'verified', 'rejected'));
alter table public.companies add column if not exists guard_reserve_pledge boolean not null default false;
grant select (msep_status, guard_reserve_pledge) on public.companies to anon, authenticated;

-- 3) How fast each employer responds: the median time from applying to the first employer status change, counting
--    unanswered applications as "no response". Server-only (service role); shown only with 5+ applications.
create or replace function public.company_response_days(ids uuid[])
returns table (company_id uuid, median_days numeric, sample integer)
language sql stable security definer set search_path = 'public' as $$
  with a as (
    select j.company_id,
           coalesce(extract(epoch from (
             select min(h.changed_at) from public.application_status_history h
              where h.application_id = ap.id and h.status in ('viewed', 'interview', 'offer', 'rejected')
           ) - ap.applied_at) / 86400.0, 9999) as d
      from public.applications ap
      join public.jobs j on j.id = ap.job_id
     where j.company_id = any(ids) and ap.source = 'lancenest' and ap.status not in ('saved', 'withdrawn')
       and ap.applied_at > now() - interval '180 days' and ap.applied_at < now() - interval '3 days'
  )
  select company_id, (percentile_cont(0.5) within group (order by d))::numeric, count(*)::integer
    from a group by company_id having count(*) >= 5;
$$;
revoke all on function public.company_response_days(uuid[]) from public, anon, authenticated;
grant execute on function public.company_response_days(uuid[]) to service_role;

-- 4) When a job closes, applications still waiting (applied or viewed) are marked "not selected" and each applicant
--    gets one plain notice, instead of hearing nothing. Interviews and offers are left alone.
create or replace function private.close_job_applications() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.status = 'closed' and old.status in ('open', 'paused') then
    perform set_config('lancenest.bulk_close', '1', true);
    with closed as (
      update public.applications set status = 'rejected'
       where job_id = new.id and source = 'lancenest' and status in ('applied', 'viewed')
      returning profile_id
    )
    insert into public.notifications (profile_id, type, title, link)
    select profile_id, 'application_status',
           'The “' || new.title || '” position has closed. The employer didn’t move forward with your application this time.',
           '/dashboard/applications'
      from closed;
    perform set_config('lancenest.bulk_close', '0', true);
  end if;
  return null;
end $$;
drop trigger if exists jobs_close_applications on public.jobs;
create trigger jobs_close_applications after update of status on public.jobs
  for each row execute function private.close_job_applications();

-- Status notices say "Not selected" instead of "Rejected", and stay quiet during the bulk close above.
create or replace function private.on_application_change() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare owner uuid; job_title text;
begin
  if tg_op = 'INSERT' and new.source = 'external' then return null; end if;
  if coalesce(current_setting('lancenest.bulk_close', true), '0') = '1' then return null; end if;
  select c.owner_id, j.title into owner, job_title from public.jobs j join public.companies c on c.id = j.company_id where j.id = new.job_id;
  if tg_op = 'INSERT' then
    perform private.notify(owner, new.profile_id, 'application', 'applied to ' || job_title, '/employer/jobs/' || new.job_id || '/applicants');
  elsif new.status is distinct from old.status and auth.uid() is not null and auth.uid() <> new.profile_id then
    perform private.notify(new.profile_id, auth.uid(), 'application_status', 'moved your application for ' || job_title || ' to “' ||
      case new.status when 'rejected' then 'Not selected' when 'viewed' then 'Viewed' when 'interview' then 'Interview' when 'offer' then 'Offer' else initcap(new.status) end
      || '”', '/dashboard/applications');
  end if;
  return null;
end $$;

-- 5) SkillBridge: the service member tracks their command's approval on the application (server-written only).
alter table public.applications add column if not exists command_approval text
  check (command_approval is null or command_approval in ('not_started', 'requested', 'approved', 'denied'));
create or replace function private.applications_server_fields() returns trigger
language plpgsql set search_path = 'public' as $$
begin
  -- Writes from LanceNest's own triggers (nested) and the server key (no user) may set it; members and employers can't.
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if tg_op = 'INSERT' then new.command_approval := null;
    elsif new.command_approval is distinct from old.command_approval then new.command_approval := old.command_approval;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists applications_server_fields on public.applications;
create trigger applications_server_fields before insert or update on public.applications
  for each row execute function private.applications_server_fields();

-- 6) Freelance: up to 3 packages per service, and an opt-in public service page.
alter table public.service_listings add column if not exists packages jsonb not null default '[]'::jsonb
  check (jsonb_typeof(packages) = 'array' and jsonb_array_length(packages) <= 3 and length(packages::text) <= 4000);
alter table public.service_listings add column if not exists public_listing boolean not null default false;
-- Package names and descriptions get the same contact-details check as the rest of the listing.
drop trigger if exists contact_guard_services on public.service_listings;
create trigger contact_guard_services before insert or update of title, description, service_area, packages on public.service_listings
  for each row execute function private.block_contact_info('title', 'description', 'service_area', 'packages');

-- 7) Freelance: proposals come back to Free members when the client closes the project without hiring, or hires
--    without ever opening theirs. viewed_at is set when the client opens the project's proposals.
alter table public.proposals add column if not exists viewed_at timestamptz;
alter table public.proposals add column if not exists credit_refunded_at timestamptz;
create or replace function private.proposals_server_fields() returns trigger
language plpgsql set search_path = 'public' as $$
begin
  -- Only the server key and LanceNest's own triggers (nested, e.g. the refund below) may set these.
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if tg_op = 'INSERT' then new.viewed_at := null; new.credit_refunded_at := null;
    else new.viewed_at := old.viewed_at; new.credit_refunded_at := old.credit_refunded_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists proposals_server_fields on public.proposals;
create trigger proposals_server_fields before insert or update on public.proposals
  for each row execute function private.proposals_server_fields();

create or replace function private.refund_dead_proposals() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare hired boolean; r record;
begin
  if old.status <> 'open' or new.status not in ('closed', 'in_progress') then return null; end if;
  hired := exists (select 1 from public.proposals where project_id = new.id and status = 'accepted');
  for r in
    select p.id, p.freelancer_id from public.proposals p
      join public.veteran_profiles v on v.profile_id = p.freelancer_id
     where p.project_id = new.id and p.status in ('submitted', 'shortlisted') and p.credit_refunded_at is null
       and coalesce(v.plan, 'free') = 'free'
       and ((not hired and new.status = 'closed') or p.viewed_at is null)
  loop
    insert into public.proposal_credits (profile_id, credits) values (r.freelancer_id, 1)
      on conflict (profile_id) do update set credits = public.proposal_credits.credits + 1, updated_at = now();
    update public.proposals set credit_refunded_at = now() where id = r.id;
    insert into public.notifications (profile_id, type, title, link)
    values (r.freelancer_id, 'proposal_status', 'Your proposal for “' || new.title || '” was returned to you, because the client '
      || case when hired then 'hired without opening it.' else 'closed the project without hiring.' end, '/freelance');
  end loop;
  return null;
end $$;
drop trigger if exists projects_refund_proposals on public.freelance_projects;
create trigger projects_refund_proposals after update of status on public.freelance_projects
  for each row execute function private.refund_dead_proposals();

-- 8) Partner Pro codes: transition offices, veterans' groups and nonprofits hand out months of Pro. Server-only.
create table if not exists public.partner_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  partner_name text not null check (char_length(partner_name) between 2 and 120),
  months integer not null default 6 check (months between 1 and 12),
  max_uses integer check (max_uses is null or max_uses between 1 and 100000),
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.partner_redemptions (
  profile_id uuid primary key references public.profiles(id) on delete cascade, -- one partner code per member, ever
  code_id uuid not null references public.partner_codes(id) on delete cascade,
  redeemed_at timestamptz not null default now()
);
alter table public.partner_codes enable row level security;
alter table public.partner_redemptions enable row level security;
revoke all on public.partner_codes, public.partner_redemptions from anon, authenticated;

create table if not exists public.partner_code_attempts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists partner_code_attempts_idx on public.partner_code_attempts (profile_id, attempted_at desc);
alter table public.partner_code_attempts enable row level security;
revoke all on public.partner_code_attempts from anon, authenticated;

-- Redeems a code in one step: at most 10 tries a day per member, one partner code per member ever, and the
-- code's use limit is enforced under a row lock. Returns the months of Pro to grant, or a negative reason
-- (-1 too many tries, -2 already used a code, -3 invalid or expired, -4 used up). It returns instead of raising,
-- so failed tries are still counted. Server-only.
create or replace function public.redeem_partner_code(p_profile uuid, p_code text) returns integer
language plpgsql security definer set search_path = 'public' as $$
declare c record; tries integer;
begin
  insert into public.partner_code_attempts (profile_id) values (p_profile);
  select count(*) into tries from public.partner_code_attempts where profile_id = p_profile and attempted_at > now() - interval '1 day';
  if tries > 10 then return -1; end if;
  if exists (select 1 from public.partner_redemptions where profile_id = p_profile) then return -2; end if;
  select * into c from public.partner_codes where code = upper(btrim(p_code)) and active and (expires_at is null or expires_at > now()) for update;
  if not found then return -3; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return -4; end if;
  insert into public.partner_redemptions (profile_id, code_id) values (p_profile, c.id);
  update public.partner_codes set uses = uses + 1 where id = c.id;
  return c.months;
end $$;
revoke all on function public.redeem_partner_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_partner_code(uuid, text) to service_role;

-- 9) Newsletter: one clearly labeled sponsored employer per weekly issue. Server-only.
create table if not exists public.newsletter_sponsors (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  headline text not null check (char_length(headline) between 4 and 90),
  body text not null check (char_length(body) between 10 and 300),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.newsletter_sponsors enable row level security;
revoke all on public.newsletter_sponsors from anon, authenticated;

-- 10) Employers' own hiring systems (Greenhouse, Lever, Ashby): applicants can be sent across. The API key is
--     encrypted by the server before it is stored (AES-256-GCM, key in Vercel). Server-only.
create table if not exists public.ats_connections (
  company_id uuid primary key references public.companies(id) on delete cascade,
  provider text not null check (provider in ('greenhouse', 'lever', 'ashby')),
  board text check (board is null or board ~ '^[A-Za-z0-9_-]{1,80}$'),
  api_key_enc text not null check (char_length(api_key_enc) <= 2000),
  key_hint text check (key_hint is null or char_length(key_hint) <= 8),
  auto_send boolean not null default false,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ats_deliveries (
  application_id uuid primary key references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('sent', 'failed')),
  error text check (error is null or char_length(error) <= 300),
  sent_at timestamptz not null default now()
);
create index if not exists ats_deliveries_company_idx on public.ats_deliveries (company_id, sent_at desc);
alter table public.ats_connections enable row level security;
alter table public.ats_deliveries enable row level security;
revoke all on public.ats_connections, public.ats_deliveries from anon, authenticated;

-- 11) Free and Starter employers see how many verified members want roles like their job (search is on Professional).
--     Counts members whose target titles share a meaningful word with the job title. Server-only.
create or replace function public.job_match_count(j uuid) returns integer
language sql stable security definer set search_path = 'public' as $$
  with words as (
    select '%' || w || '%' as pat
      from public.jobs, regexp_split_to_table(lower(title), '[^a-z0-9]+') as w
     where id = j and length(w) >= 4
       and w not in ('senior', 'junior', 'level', 'remote', 'hybrid', 'part', 'full', 'time', 'with', 'from', 'contract', 'temporary')
  )
  select count(*)::integer from public.veteran_profiles v
   where v.verification_status = 'verified' and v.is_public
     and exists (select 1 from unnest(coalesce(v.desired_titles, '{}'::text[])) t, words where t ilike words.pat);
$$;
revoke all on function public.job_match_count(uuid) from public, anon, authenticated;
grant execute on function public.job_match_count(uuid) to service_role;

-- New tables: no truncate/trigger for client roles (matches 0067).
revoke truncate, trigger on public.partner_codes, public.partner_redemptions, public.partner_code_attempts, public.newsletter_sponsors,
  public.ats_connections, public.ats_deliveries from anon, authenticated;
