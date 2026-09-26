-- =====================================================================
-- LanceNest — trust & safety: auto-hide reported content, new-device
-- tracking, job auto-expiry, reposting refreshes the date
-- =====================================================================

-- Content hidden automatically after 3 different members report it (pending admin review).
alter table public.network_posts add column if not exists hidden boolean not null default false;
alter table public.post_comments add column if not exists hidden boolean not null default false;

drop policy if exists posts_read on public.network_posts;
create policy posts_read on public.network_posts for select
  using ((not hidden or author_id = auth.uid() or private.is_admin()) and private.can_view_post(author_id, visibility));
drop policy if exists comments_read on public.post_comments;
create policy comments_read on public.post_comments for select
  using (private.can_view_post_id(post_id) and (not hidden or author_id = auth.uid() or private.is_admin()));

create or replace function private.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare reporters integer;
begin
  if new.target_type not in ('post', 'comment') then return null; end if;
  select count(distinct reporter_id) into reporters from public.reports
   where target_type = new.target_type and target_id = new.target_id and status in ('open', 'reviewing');
  if reporters >= 3 then
    if new.target_type = 'post' then update public.network_posts set hidden = true where id = new.target_id;
    else update public.post_comments set hidden = true where id = new.target_id; end if;
  end if;
  return null;
end $$;
revoke execute on function private.auto_hide_reported() from public, anon, authenticated;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports for each row execute function private.auto_hide_reported();

-- Devices each member has signed in from (for new-device alerts).
create table if not exists public.login_devices (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  device_hash text not null,
  label text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (profile_id, device_hash)
);
alter table public.login_devices enable row level security;
drop policy if exists login_devices_own on public.login_devices;
create policy login_devices_own on public.login_devices for select to authenticated using (profile_id = auth.uid());

-- Reopening a job counts as reposting it (fresh date, full 60 days).
create or replace function private.repost_job()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'open' and old.status <> 'open' then new.posted_at := now(); end if;
  return new;
end $$;
drop trigger if exists jobs_repost on public.jobs;
create trigger jobs_repost before update of status on public.jobs for each row execute function private.repost_job();

-- Jobs close automatically after 60 days so stale or abandoned listings don't linger.
create or replace function private.expire_old_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    update public.jobs set status = 'closed'
     where status = 'open' and posted_at < now() - interval '60 days'
    returning id, company_id, title
  ), notified as (
    insert into public.notifications (profile_id, type, title, link)
    select c.owner_id, 'job_expired', 'Your job “' || e.title || '” closed after 60 days. Reopen it anytime to repost.', '/employer/jobs/' || e.id
      from expired e join public.companies c on c.id = e.company_id where c.owner_id is not null
    returning 1
  )
  select count(*) into n from expired;
  return n;
end $$;
revoke execute on function private.expire_old_jobs() from public, anon, authenticated;

-- Daily at 10:15 UTC (~6:15 AM Eastern). Requires the pg_cron extension (available on Supabase).
create extension if not exists pg_cron;
select cron.schedule('lancenest-expire-jobs', '15 10 * * *', 'select private.expire_old_jobs()');
