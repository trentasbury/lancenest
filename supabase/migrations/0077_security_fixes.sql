-- 0077: Fixes from the October 2026 security review. Additive: functions replaced, triggers created or replaced,
-- one new column (default off), and write permissions the public (signed-out) role never used are removed.

-- 1) Job caps: an open SkillBridge job switched to another job type now counts toward the plan's open-job limit
--    (before, the switch skipped the check, so SkillBridge-authorized employers could exceed their cap).
create or replace function private.enforce_job_limit() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare
  c record;
  open_count integer;
  cap integer;
begin
  if auth.uid() is null or new.status <> 'open' or new.employment_type = 'skillbridge' then return new; end if;
  -- Already open and already counted: nothing changes.
  if tg_op = 'UPDATE' and old.status = 'open' and old.employment_type <> 'skillbridge' then return new; end if;
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
create or replace trigger jobs_free_plan_limit before insert or update of status, employment_type on public.jobs
  for each row execute function private.enforce_job_limit();

-- 2) Every open job shows pay, enforced by the database too (before, only the website checked, so a direct API
--    call could publish a job without pay). SkillBridge is exempt (DoD pays participants). Server jobs (imports) and
--    admins are exempt; imports without pay already arrive as drafts.
create or replace function private.require_job_pay() returns trigger
language plpgsql set search_path = 'public' as $$
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  if new.status = 'open' and new.employment_type <> 'skillbridge' and (new.salary_min is null or new.salary_max is null) then
    raise exception 'salary_required' using errcode = 'P0020', hint = 'Open jobs must show a pay range.';
  end if;
  return new;
end $$;
create or replace trigger jobs_require_pay before insert or update of status, employment_type, salary_min, salary_max on public.jobs
  for each row execute function private.require_job_pay();

-- 3) Service packages: the database now checks each package the way the website does (name, price of at least
--    $25, 1 to 90 days, what's included). Before, a direct API call could save any price or text.
create or replace function private.check_service_packages() returns trigger
language plpgsql set search_path = 'public' as $$
declare p jsonb;
begin
  for p in select * from jsonb_array_elements(coalesce(new.packages, '[]'::jsonb)) loop
    if jsonb_typeof(p) <> 'object'
       or (select count(*) from jsonb_object_keys(p) k where k not in ('name', 'price_cents', 'days', 'includes')) > 0
       or jsonb_typeof(p->'name') is distinct from 'string' or char_length(p->>'name') not between 3 and 40
       or jsonb_typeof(p->'includes') is distinct from 'string' or char_length(p->>'includes') not between 5 and 200
       or jsonb_typeof(p->'price_cents') is distinct from 'number' or (p->>'price_cents') !~ '^[0-9]{4,9}$'
       or (p->>'price_cents')::bigint not between 2500 and 100000000
       or jsonb_typeof(p->'days') is distinct from 'number' or (p->>'days') !~ '^[0-9]{1,2}$' or (p->>'days')::int not between 1 and 90 then
      raise exception 'package_invalid' using errcode = 'P0021', hint = 'Each package needs a name, a price of at least $25, 1 to 90 days and what is included.';
    end if;
  end loop;
  return new;
end $$;
create or replace trigger service_packages_valid before insert or update of packages on public.service_listings
  for each row execute function private.check_service_packages();

-- 4) Returned proposals: only a proposal that used a bought credit gives a credit back. A free monthly proposal
--    that comes back in the same month stops counting toward that month's 5; one from an earlier month had
--    already expired, so nothing is added. (Before, every returned proposal added a permanent credit, which
--    turned expiring free proposals into banked ones.)
alter table public.proposals add column if not exists used_credit boolean not null default false;

create or replace function private.proposal_rules() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare vplan text; used integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.used_credit := false;
    if not exists (select 1 from public.freelance_projects where id = new.project_id and status = 'open') then
      raise exception 'project_closed' using errcode = 'P0005';
    end if;
    select plan into vplan from public.veteran_profiles where profile_id = new.freelancer_id;
    if coalesce(vplan, 'free') = 'free' then
      select count(*) into used from public.proposals
       where freelancer_id = new.freelancer_id and created_at >= date_trunc('month', now())
         and (credit_refunded_at is null or used_credit);
      if used >= 5 then
        update public.proposal_credits set credits = credits - 1, updated_at = now() where profile_id = new.freelancer_id and credits > 0;
        if not found then raise exception 'proposal_limit' using errcode = 'P0006'; end if;
        new.used_credit := true;
      end if;
    end if;
    return new;
  end if;
  -- Members and clients can't change who paid for a proposal.
  new.used_credit := old.used_credit;
  if new.status is distinct from old.status then
    if auth.uid() = old.freelancer_id and new.status <> 'withdrawn' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if auth.uid() <> old.freelancer_id and new.status not in ('shortlisted', 'declined') then raise exception 'not_allowed' using errcode = '42501'; end if;
  end if;
  return new;
end $$;

create or replace function private.refund_dead_proposals() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare hired boolean; r record; why text;
begin
  if old.status <> 'open' or new.status not in ('closed', 'in_progress') then return null; end if;
  hired := exists (select 1 from public.proposals where project_id = new.id and status = 'accepted');
  why := case when hired then 'the client hired without opening it' else 'the client closed the project without hiring' end;
  for r in
    select p.id, p.freelancer_id, p.used_credit, p.created_at >= date_trunc('month', now()) as this_month
      from public.proposals p
      join public.veteran_profiles v on v.profile_id = p.freelancer_id
     where p.project_id = new.id and p.status in ('submitted', 'shortlisted') and p.credit_refunded_at is null
       and coalesce(v.plan, 'free') = 'free'
       and ((not hired and new.status = 'closed') or p.viewed_at is null)
  loop
    if r.used_credit then
      insert into public.proposal_credits (profile_id, credits) values (r.freelancer_id, 1)
        on conflict (profile_id) do update set credits = public.proposal_credits.credits + 1, updated_at = now();
      update public.proposals set credit_refunded_at = now() where id = r.id;
      insert into public.notifications (profile_id, type, title, link)
      values (r.freelancer_id, 'proposal_status', 'Your proposal credit for “' || new.title || '” was returned, because ' || why || '.', '/freelance');
    elsif r.this_month then
      update public.proposals set credit_refunded_at = now() where id = r.id;
      insert into public.notifications (profile_id, type, title, link)
      values (r.freelancer_id, 'proposal_status', 'Your proposal for “' || new.title || '” no longer counts toward this month’s 5 free proposals, because ' || why || '.', '/freelance');
    end if;
  end loop;
  return null;
end $$;

-- 5) Signed-out visitors never write to the database directly (every write policy is for signed-in users, and the
--    server uses its own key). Remove the write permissions Supabase grants the public role by default, so a
--    future policy mistake can't open a table to anonymous writes. Reads are unchanged.
revoke insert, update, delete, truncate, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, trigger on tables from anon;
