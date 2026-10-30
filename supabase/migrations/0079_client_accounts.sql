-- 0079: Free client accounts. Anyone can hire a verified veteran freelancer: clients post projects, book services,
-- message the freelancers they're hiring, pay booking fees and leave reviews. They can't see the member network,
-- jobs, candidates or anyone they aren't working with. Freelancers are always verified service members or spouses.

-- 1) The new role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('veteran', 'employer', 'admin', 'client'));

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare
  safe_role text := case new.raw_user_meta_data ->> 'role' when 'employer' then 'employer' when 'client' then 'client' else 'veteran' end;
  safe_type text := case when new.raw_user_meta_data ->> 'member_type' = 'spouse' then 'spouse' else 'service_member' end;
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  base_slug text;
begin
  base_slug := trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'member'; end if;

  insert into public.profiles (id, role, full_name, username)
  values (new.id, safe_role, display_name, base_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6));

  if safe_role = 'veteran' then
    insert into public.veteran_profiles (profile_id, member_type) values (new.id, safe_type);
  end if;
  return new;
end $$;

-- 2) Helpers.
create or replace function private.is_active_client() returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'client'
                  and not p.banned and coalesce(p.suspended_until, '-infinity') <= now());
$$;

-- Freelancers a client may see: anyone offering an active service, anyone who sent them a proposal, anyone they hired.
create or replace function private.client_can_see(target uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.service_listings s where s.profile_id = target and s.status = 'active')
      or exists (select 1 from public.contracts k where k.freelancer_id = target and k.client_id = auth.uid())
      or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id
                  where pr.freelancer_id = target and fp.client_id = auth.uid());
$$;
revoke all on function private.is_active_client(), private.client_can_see(uuid) from public, anon;
grant execute on function private.is_active_client(), private.client_can_see(uuid) to authenticated;

-- Members only see a client's profile when they're working with them or the client has an open project.
create or replace function private.profile_visible(target uuid, target_role text) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select case
    when target_role = 'client' then
      exists (select 1 from public.contracts k where k.client_id = target and k.freelancer_id = auth.uid())
      or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id
                  where fp.client_id = target and pr.freelancer_id = auth.uid())
      or exists (select 1 from public.freelance_projects fp where fp.client_id = target and fp.status = 'open')
    when target_role is distinct from 'veteran' then true
    when private.app_role() is distinct from 'employer' then true
    else private.employer_can_see(target)
      or exists (select 1 from public.contracts k where k.freelancer_id = target and k.client_id = auth.uid())
      or exists (select 1 from public.fair_registrations fr join public.fair_booths b on b.fair_id = fr.fair_id
                  where fr.profile_id = target and private.owns_company(b.company_id))
      or (not private.hidden_from_viewer(target) and (
            exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public)
         or exists (select 1 from public.network_posts p where p.author_id = target and not p.hidden and p.visibility in ('public', 'network'))
         or exists (select 1 from public.post_comments c where c.author_id = target and not c.hidden)
         or exists (select 1 from public.service_listings s where s.profile_id = target and s.status = 'active')
         or exists (select 1 from public.mentor_profiles m where m.profile_id = target and m.available)
         or exists (select 1 from public.user_follows f where f.follower_id = target and f.following_id = auth.uid())
         or exists (select 1 from public.company_followers cf where cf.profile_id = target and private.owns_company(cf.company_id))))
  end;
$$;

-- Contact details stay locked between a client and a freelancer until a job is booked, same as for employers.
create or replace function private.freelance_contact_locked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  with r as (select id, role from public.profiles where id in (a, b)),
       e as (select id from r where role in ('employer', 'client') limit 1),
       v as (select id from r where role = 'veteran' limit 1)
  select exists (select 1 from e) and exists (select 1 from v)
    and not exists (
      select 1 from public.contracts k
       where k.client_id = (select id from e) and k.freelancer_id = (select id from v) and k.status <> 'cancelled'
         and (k.booking_status = 'paid'
              or (k.booking_status = 'not_required' and exists (select 1 from public.milestones m where m.contract_id = k.id and m.funded_at is not null))))
    and not exists (
      select 1 from public.applications ap
        join public.jobs j on j.id = ap.job_id
        join public.companies c on c.id = j.company_id
       where ap.profile_id = (select id from v) and ap.source = 'lancenest'
         and (c.owner_id = (select id from e)
              or exists (select 1 from public.company_members cm where cm.company_id = c.id and cm.profile_id = (select id from e))))
    and (
      exists (select 1 from public.proposals p join public.freelance_projects fp on fp.id = p.project_id
               where p.freelancer_id = (select id from v) and fp.client_id = (select id from e))
      or exists (select 1 from public.contracts k where k.client_id = (select id from e) and k.freelancer_id = (select id from v) and k.booking_status = 'awaiting_payment')
      or exists (select 1 from public.service_listings s where s.profile_id = (select id from v) and s.status = 'active'));
$$;

create or replace function public.verified_work_summary(ids uuid[])
returns table (profile_id uuid, completed integer, avg_rating numeric)
language sql stable security definer set search_path = 'public' as $$
  select k.freelancer_id, count(distinct k.id)::integer, round(avg(r.rating)::numeric, 1)
    from public.contracts k
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id
   where k.freelancer_id = any(ids) and k.status = 'completed' and (private.is_verified_member() or private.is_active_client())
   group by k.freelancer_id;
$$;

-- 3) Clients post projects as themselves (no company), at most 3 open at a time.
alter policy projects_insert on public.freelance_projects with check (
  client_id = (select auth.uid()) and (
    (private.app_role() = 'employer' and private.owns_company(company_id)
       and exists (select 1 from public.companies c where c.id = freelance_projects.company_id and c.is_verified))
    or (private.is_active_client() and company_id is null)));

create or replace function private.client_project_cap() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.status = 'open' and exists (select 1 from public.profiles p where p.id = new.client_id and p.role = 'client')
     and (select count(*) from public.freelance_projects fp where fp.client_id = new.client_id and fp.status = 'open' and fp.id <> new.id) >= 3 then
    raise exception 'client_project_limit' using errcode = 'P0023', hint = 'Clients can have 3 open projects at a time.';
  end if;
  return new;
end $$;
revoke all on function private.client_project_cap() from public, anon, authenticated;
create or replace trigger client_project_cap before insert or update of status on public.freelance_projects
  for each row execute function private.client_project_cap();

-- 4) What clients can read: the freelancers they can hire, their portfolios, active services and reviews.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_clients') then
    create policy profiles_select_clients on public.profiles for select to authenticated
      using (private.is_active_client() and not banned and role = 'veteran' and private.client_can_see(id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'freelancer_profiles' and policyname = 'freelancer_profiles_read_clients') then
    create policy freelancer_profiles_read_clients on public.freelancer_profiles for select to authenticated
      using (private.is_active_client() and private.client_can_see(profile_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'portfolio_items' and policyname = 'portfolio_read_clients') then
    create policy portfolio_read_clients on public.portfolio_items for select to authenticated
      using (private.is_active_client() and private.client_can_see(profile_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_listings' and policyname = 'services_read_clients') then
    create policy services_read_clients on public.service_listings for select to authenticated
      using (status = 'active' and private.is_active_client());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and policyname = 'reviews_read_clients') then
    create policy reviews_read_clients on public.reviews for select to authenticated using (private.is_active_client());
  end if;
end $$;

-- 5) What clients can write: messages in conversations they're part of, and reviews after a completed contract.
alter policy messages_insert on public.messages with check (
  sender_id = (select auth.uid()) and (private.is_verified_member() or private.is_active_client()) and private.is_participant(conversation_id));

alter policy reviews_insert on public.reviews with check (
  reviewer_id = (select auth.uid()) and (private.is_verified_member() or private.is_active_client()) and exists (
    select 1 from public.contracts k
     where k.id = reviews.contract_id and k.status = 'completed'
       and ((k.client_id = (select auth.uid()) and k.freelancer_id = reviews.reviewee_id)
         or (k.freelancer_id = (select auth.uid()) and k.client_id = reviews.reviewee_id))));
