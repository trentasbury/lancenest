-- =====================================================================
-- 0105 (November 6, 2026): the Free employer plan keeps 2 jobs open at once (was 3). Jobs already open stay open;
-- the limit applies when a job is posted or reopened. Starter 10 and Professional 25 are unchanged.
-- =====================================================================

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
  cap := case c.plan when 'free' then 2 when 'starter' then 10 when 'professional' then 25 else null end;
  if cap is not null then
    select count(*) into open_count from public.jobs
     where company_id = new.company_id and status = 'open' and id <> new.id and employment_type <> 'skillbridge';
    if open_count >= cap + coalesce(c.extra_job_slots, 0) then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'Open-job limit reached for this plan.';
    end if;
  end if;
  return new;
end $$;
