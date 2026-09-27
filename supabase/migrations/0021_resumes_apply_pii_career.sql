-- =====================================================================
-- LinkedIn-style résumés (up to 3; attached per application), external
-- apply links (anti-phishing), PII guard on text, military career fields
-- =====================================================================

-- Résumés: up to 3 saved, one default; employers see ONLY the résumé attached to an application to their job.
drop index if exists public.resumes_one_per_profile;
alter table public.resumes add column if not exists is_default boolean not null default false;
create or replace function private.resume_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.resumes where profile_id = new.profile_id) >= 3 then
    raise exception 'resume_limit' using errcode = 'P0010';
  end if;
  return new;
end $$;
revoke execute on function private.resume_limit() from public, anon, authenticated;
drop trigger if exists resumes_limit on public.resumes;
create trigger resumes_limit before insert on public.resumes for each row execute function private.resume_limit();

alter table public.applications add column if not exists resume_id uuid references public.resumes (id) on delete set null;
alter table public.applications add column if not exists source text not null default 'lancenest';
alter table public.applications drop constraint if exists applications_source_check;
alter table public.applications add constraint applications_source_check check (source in ('lancenest', 'external'));

drop policy if exists resumes_employer_read on public.resumes;
create policy resumes_employer_read on public.resumes for select to authenticated
  using ((private.app_role() = 'employer' and private.is_verified_member()
          and exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                      where a.resume_id = resumes.id and c.owner_id = auth.uid() and c.is_verified and a.status <> 'withdrawn'))
         or private.is_admin());

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own on public.applications for insert to authenticated
  with check (profile_id = auth.uid() and status = 'applied' and private.app_role() = 'veteran' and private.is_verified_member()
              and (resume_id is null or exists (select 1 from public.resumes r where r.id = resume_id and r.profile_id = auth.uid())));

-- External "Apply on company site": only the company's verified domain or a known applicant-tracking system.
alter table public.jobs add column if not exists apply_url text;
grant insert (apply_url) on public.jobs to authenticated;
grant update (apply_url) on public.jobs to authenticated;
create or replace function private.check_apply_url()
returns trigger language plpgsql security definer set search_path = public as $$
declare host text; site text;
begin
  if new.apply_url is null or new.apply_url = '' then new.apply_url := null; return new; end if;
  host := lower(substring(new.apply_url from '^https://([^/:?#]+)'));
  select lower(regexp_replace(substring(c.verification_details ->> 'website' from '^https?://([^/:?#]+)'), '^www\.', ''))
    into site from public.companies c where c.id = new.company_id;
  if host is null or not (
       (site is not null and (host = site or host like '%.' || site))
    or host ~ '(^|\.)(myworkdayjobs\.com|myworkdaysite\.com|greenhouse\.io|lever\.co|icims\.com|smartrecruiters\.com|jobvite\.com|taleo\.net|ashbyhq\.com|bamboohr\.com|workable\.com|paylocity\.com|adp\.com|ultipro\.com|ukg\.com|successfactors\.com|oraclecloud\.com|recruiting\.paylocity\.com|applytojob\.com|breezy\.hr|jazzhr\.com|clearcompany\.com)$')
  then
    raise exception 'apply_url_not_allowed' using errcode = 'P0008', hint = 'Use your verified company domain or a standard applicant-tracking system.';
  end if;
  return new;
end $$;
revoke execute on function private.check_apply_url() from public, anon, authenticated;
drop trigger if exists jobs_check_apply_url on public.jobs;
create trigger jobs_check_apply_url before insert or update of apply_url on public.jobs for each row execute function private.check_apply_url();

-- Clicking out to a company site isn't a confirmed application: don't notify the employer.
create or replace function private.on_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; job_title text;
begin
  if tg_op = 'INSERT' and new.source = 'external' then return null; end if;
  select c.owner_id, j.title into owner, job_title from public.jobs j join public.companies c on c.id = j.company_id where j.id = new.job_id;
  if tg_op = 'INSERT' then
    perform private.notify(owner, new.profile_id, 'application', 'applied to ' || job_title, '/employer/jobs/' || new.job_id || '/applicants');
  elsif new.status is distinct from old.status and auth.uid() is not null and auth.uid() <> new.profile_id then
    perform private.notify(new.profile_id, auth.uid(), 'application_status', 'moved your application for ' || job_title || ' to “' || initcap(new.status) || '”', '/dashboard/applications');
  end if;
  return null;
end $$;

-- PII guard: text that looks like a Social Security number never saves.
create or replace function private.block_pii()
returns trigger language plpgsql security definer set search_path = public as $$
declare txt text := to_jsonb(new) ->> tg_argv[0];
begin
  if txt ~ '(^|[^0-9])[0-9]{3}[- .][0-9]{2}[- .][0-9]{4}([^0-9]|$)'
     or txt ~* '(ssn|social security)[^0-9]{0,25}[0-9]{9}' then
    raise exception 'pii_detected' using errcode = 'P0009', hint = 'This looks like a Social Security number. Never share it on LanceNest.';
  end if;
  return new;
end $$;
revoke execute on function private.block_pii() from public, anon, authenticated;
drop trigger if exists pii_posts on public.network_posts;
create trigger pii_posts before insert or update of body on public.network_posts for each row execute function private.block_pii('body');
drop trigger if exists pii_comments on public.post_comments;
create trigger pii_comments before insert or update of body on public.post_comments for each row execute function private.block_pii('body');
drop trigger if exists pii_messages on public.messages;
create trigger pii_messages before insert on public.messages for each row execute function private.block_pii('body');
drop trigger if exists pii_proposals on public.proposals;
create trigger pii_proposals before insert on public.proposals for each row execute function private.block_pii('cover_letter');
drop trigger if exists pii_projects on public.freelance_projects;
create trigger pii_projects before insert or update of description on public.freelance_projects for each row execute function private.block_pii('description');

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'fraud', 'inappropriate', 'fake_job', 'harassment', 'fake_information', 'impersonation', 'sensitive_info', 'other'));

-- Military career, LinkedIn-style: billet, unit, accomplishments.
alter table public.military_service add column if not exists duty_title text check (duty_title is null or char_length(duty_title) <= 120);
alter table public.military_service add column if not exists unit text check (unit is null or char_length(unit) <= 120);
alter table public.military_service add column if not exists description text check (description is null or char_length(description) <= 2000);
