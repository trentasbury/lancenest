-- =====================================================================
-- LanceNest — service member accounts must be VERIFIED to use the platform.
-- Unverified veteran accounts can only build their profile and submit
-- verification. Enforced here so the API can't be used to get around it.
-- =====================================================================
create or replace function private.is_verified_member()
returns boolean language sql stable security definer set search_path = public as $$
  select case private.app_role()
    when 'admin' then true
    when 'employer' then true
    when 'veteran' then exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.verification_status = 'verified')
    else false
  end;
$$;

-- Member directory: verified members only (everyone can still read their own row).
drop policy if exists profiles_select_members on public.profiles;
create policy profiles_select_members on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_verified_member());

-- Jobs: verified members only (employers always see their own postings).
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated
  using ((status = 'open' and private.is_verified_member()) or private.owns_company(company_id) or private.is_admin());

-- Applying requires verification.
drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own on public.applications for insert to authenticated
  with check (profile_id = auth.uid() and status = 'applied' and private.app_role() = 'veteran' and private.is_verified_member());

-- Network: reading member-only posts and every write action require verification.
create or replace function private.can_view_post(author uuid, vis text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = author
      or private.is_admin()
      or (not private.is_blocked_between(auth.uid(), author) and (
            vis = 'public'
         or (vis = 'network' and auth.uid() is not null and private.is_verified_member())
         or (vis = 'connections' and private.is_verified_member() and private.are_connected(auth.uid(), author))));
$$;

drop policy if exists posts_insert on public.network_posts;
create policy posts_insert on public.network_posts for insert to authenticated
  with check (author_id = auth.uid() and private.is_verified_member() and (shared_post_id is null or private.can_share(shared_post_id)));
drop policy if exists reactions_write on public.post_reactions;
create policy reactions_write on public.post_reactions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.is_verified_member() and private.can_view_post_id(post_id));
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and private.is_verified_member() and private.can_view_post_id(post_id)
              and not private.is_blocked_between(auth.uid(), (select p.author_id from public.network_posts p where p.id = post_id)));
drop policy if exists follows_insert on public.user_follows;
create policy follows_insert on public.user_follows for insert to authenticated
  with check (follower_id = auth.uid() and private.is_verified_member() and not private.is_blocked_between(follower_id, following_id));

-- Messaging requires verification.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and private.is_verified_member() and private.is_participant(conversation_id));

-- Employers only discover VERIFIED veterans (applicants/conversations aside).
create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.plan in ('professional', 'federal', 'enterprise'))
          and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                 where a.profile_id = target and c.owner_id = auth.uid())
      or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
                 where p1.profile_id = auth.uid() and p2.profile_id = target);
$$;
