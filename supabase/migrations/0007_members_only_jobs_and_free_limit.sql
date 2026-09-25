-- =====================================================================
-- LanceNest — jobs are members-only; Free employer plan = 2 open jobs
-- =====================================================================

-- Signed-out visitors (and the public API) can no longer read job listings.
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated
  using (status = 'open' or private.owns_company(company_id) or private.is_admin());

drop policy if exists job_skills_read on public.job_skills;
create policy job_skills_read on public.job_skills for select to authenticated using (true);

-- Free plan: at most 2 open jobs at a time. Paid plans are unlimited.
create or replace function private.enforce_job_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  plan_name text;
  open_count integer;
begin
  if auth.uid() is null or new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  select plan into plan_name from public.companies where id = new.company_id;
  if plan_name = 'free' then
    select count(*) into open_count from public.jobs where company_id = new.company_id and status = 'open' and id <> new.id;
    if open_count >= 2 then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'The Free plan includes 2 open job posts. Upgrade for unlimited posts.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.enforce_job_limit() from public, anon, authenticated;

drop trigger if exists jobs_free_plan_limit on public.jobs;
create trigger jobs_free_plan_limit before insert or update of status on public.jobs
  for each row execute function private.enforce_job_limit();
