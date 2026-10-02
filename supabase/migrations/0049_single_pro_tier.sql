-- Single member Pro tier: every paid member gets the full set of perks (48-hour early access, cleared-only alerts, 10 alerts).
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated
  using ((status = 'open' and private.is_verified_member()
          and (coalesce(clearance_required, 'none') = 'none'
               or posted_at <= now() - interval '48 hours'
               or private.app_role() <> 'veteran'
               or exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan <> 'free')))
         or private.owns_company(company_id) or private.is_admin());

create or replace function private.alert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer;
begin
  select case when plan <> 'free' then 10 else 0 end into cap from public.veteran_profiles where profile_id = new.profile_id;
  if (select count(*) from public.job_alerts where profile_id = new.profile_id) >= coalesce(cap, 0) then raise exception 'alert_limit' using errcode = 'P0014'; end if;
  return new;
end $$;

-- Professional includes 3 seats.
create or replace function private.seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer; used integer;
begin
  select case plan when 'professional' then 3 when 'federal' then 5 when 'enterprise' then 20 else 1 end into cap from public.companies where id = new.company_id;
  select 1 + count(*) into used from public.company_members where company_id = new.company_id;
  if used >= cap then raise exception 'seat_limit' using errcode = 'P0013'; end if;
  return new;
end $$;
