-- 0065: Second security pass. Additive: helper functions, tightened policies, link checks, reserved names.

-- 1) Employers no longer see the whole veteran directory through the API. A veteran's name and headline are visible to an
--    employer only with a reason: paid candidate search, an application, a proposal, a conversation, a contract, a fair
--    booth, or the veteran's own public activity (public profile, posts, comments, services, mentoring, following them).
--    Veterans still see each other (the network), and everyone still sees employers.
create or replace function private.employer_verified() returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.companies c where c.is_verified and private.owns_company(c.id));
$$;

create or replace function private.profile_visible(target uuid, target_role text) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select case
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

alter policy profiles_select_members on public.profiles
  using ((id = (select auth.uid())) or private.is_admin()
         or (private.is_verified_member() and not banned and private.profile_visible(id, role)));

-- 2) Employer accounts can post, comment, react, follow, and join groups only after their company is verified
--    (stops fake recruiters who sign up and never verify).
create or replace function private.can_engage() returns boolean
language sql stable security definer set search_path = 'public' as $$
  select private.is_verified_member() and (private.app_role() is distinct from 'employer' or private.employer_verified());
$$;

alter policy posts_insert on public.network_posts
  with check ((author_id = (select auth.uid())) and private.can_engage() and ((shared_post_id is null) or private.can_share(shared_post_id)));
alter policy comments_insert on public.post_comments
  with check ((author_id = (select auth.uid())) and private.can_engage() and private.can_view_post_id(post_id)
              and not private.is_blocked_between((select auth.uid()), (select p.author_id from public.network_posts p where p.id = post_comments.post_id)));
alter policy reactions_write on public.post_reactions
  with check ((profile_id = (select auth.uid())) and private.can_engage() and private.can_view_post_id(post_id));
alter policy follows_insert on public.user_follows
  with check ((follower_id = (select auth.uid())) and private.can_engage() and not private.is_blocked_between(follower_id, following_id));
alter policy group_members_join on public.group_members
  with check ((profile_id = (select auth.uid())) and private.can_engage());

-- 3) Links members save must be web links (blocks "javascript:" links that would run code for whoever clicks them).
alter table public.companies add constraint companies_website_http check (website is null or website ~* '^https?://');
alter table public.portfolio_items add constraint portfolio_items_url_http check (url is null or url ~* '^https?://');
alter table public.fair_booths add constraint fair_booths_video_https check (video_url is null or video_url ~* '^https://');

-- 4) Nobody but LanceNest staff can use LanceNest, admin, or moderator in a name (stops staff impersonation and phishing).
create or replace function private.block_reserved_names() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_table_name = 'profiles' then
    if new.role = 'admin' then return new; end if;
    if new.full_name ~* '\m(lancenest|admin|administrator|moderator)\M'
       or new.full_name ~* '\m(support|trust\s*(&|and)?\s*safety|verification)\s+team\M'
       or new.username ~* '\m(lancenest|admin|administrator|moderator)\M' then
      raise exception 'reserved_name' using errcode = 'P0019', hint = 'Names can’t include LanceNest, admin, or moderator.';
    end if;
  elsif new.name ~* '\mlancenest\M' and not private.is_admin() then
    raise exception 'reserved_name' using errcode = 'P0019', hint = 'Company names can’t include LanceNest.';
  end if;
  return new;
end $$;
create or replace trigger reserved_names_profiles before insert or update of full_name, username on public.profiles
  for each row execute function private.block_reserved_names();
create or replace trigger reserved_names_companies before insert or update of name on public.companies
  for each row execute function private.block_reserved_names();
