-- Professional: 2 seats and 10 open jobs (plus any extra job slots). Federal and Enterprise stay unlimited.
create or replace function private.enforce_job_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  open_count integer;
  cap integer;
begin
  if auth.uid() is null or new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  select plan, extra_job_slots into c from public.companies where id = new.company_id;
  cap := case c.plan when 'free' then 2 when 'professional' then 10 else null end;
  if cap is not null then
    select count(*) into open_count from public.jobs where company_id = new.company_id and status = 'open' and id <> new.id;
    if open_count >= cap + coalesce(c.extra_job_slots, 0) then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'Open-job limit reached for this plan.';
    end if;
  end if;
  return new;
end $$;
create or replace function private.seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer; used integer;
begin
  select case plan when 'professional' then 2 when 'federal' then 5 when 'enterprise' then 20 else 1 end into cap from public.companies where id = new.company_id;
  select 1 + count(*) into used from public.company_members where company_id = new.company_id;
  if used >= cap then raise exception 'seat_limit' using errcode = 'P0013'; end if;
  return new;
end $$;
