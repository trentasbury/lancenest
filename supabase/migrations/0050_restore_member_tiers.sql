-- Pricing restored to three member tiers: 48-hour early access for Federal members; alert caps Pro 3 / Pro Plus 5 / Federal 10 (cleared-only for Federal); Professional 2 seats.
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated
  using ((status = 'open' and private.is_verified_member()
          and (coalesce(clearance_required, 'none') = 'none'
               or posted_at <= now() - interval '48 hours'
               or private.app_role() <> 'veteran'
               or exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.plan = 'federal_pro')))
         or private.owns_company(company_id) or private.is_admin());
create or replace function private.alert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap integer;
begin
  select case plan when 'federal_pro' then 10 when 'pro_plus' then 5 when 'pro' then 3 else 0 end into cap from public.veteran_profiles where profile_id = new.profile_id;
  if (select count(*) from public.job_alerts where profile_id = new.profile_id) >= coalesce(cap, 0) then raise exception 'alert_limit' using errcode = 'P0014'; end if;
  if new.cleared_only and not exists (select 1 from public.veteran_profiles where profile_id = new.profile_id and plan = 'federal_pro') then new.cleared_only := false; end if;
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
