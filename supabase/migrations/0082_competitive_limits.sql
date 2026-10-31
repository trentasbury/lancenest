-- 0082: Competitive pricing (approved October 30, 2026). More in each employer plan at the same prices:
-- Free 3 open jobs (was 2), Starter 10 jobs and 2 seats (was 5 and 1), Professional 25 jobs and 3 seats (was 10 and 2).
-- Functions are replaced in place; nothing is dropped.

create or replace function private.enforce_job_limit() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare
  c record;
  open_count integer;
  cap integer;
begin
  if auth.uid() is null or new.status <> 'open' or new.employment_type = 'skillbridge' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' and old.employment_type <> 'skillbridge' then return new; end if;
  select plan, extra_job_slots into c from public.companies where id = new.company_id;
  cap := case c.plan when 'free' then 3 when 'starter' then 10 when 'professional' then 25 else null end;
  if cap is not null then
    select count(*) into open_count from public.jobs
     where company_id = new.company_id and status = 'open' and id <> new.id and employment_type <> 'skillbridge';
    if open_count >= cap + coalesce(c.extra_job_slots, 0) then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'Open-job limit reached for this plan.';
    end if;
  end if;
  return new;
end $$;

create or replace function private.seat_limit() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare cap integer; used integer;
begin
  select case plan when 'starter' then 2 when 'professional' then 3 when 'federal' then 5 when 'enterprise' then 20 else 1 end into cap
    from public.companies where id = new.company_id;
  select 1 + count(*) into used from public.company_members where company_id = new.company_id;
  if used >= cap then raise exception 'seat_limit' using errcode = 'P0013'; end if;
  return new;
end $$;
