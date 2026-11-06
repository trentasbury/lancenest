-- =====================================================================
-- 0101 (November 6, 2026): member-created communities.
-- Verified members can start a group (faith, friends, unit, spouses, interest, support, veteran business...) with
-- a written reason. LanceNest approves it before it appears. Groups are open (any verified member joins) or private
-- (the group's owner or moderators approve each request, and only members see its posts). The starter becomes the
-- owner and can name moderators. LanceNest's own branch, state, career and transition groups stay as they are.
-- =====================================================================

alter table public.groups alter column kind drop not null;   -- member groups use category instead
alter table public.groups
  add column category text check (category in ('faith', 'friends', 'unit', 'spouses', 'interest', 'support', 'business', 'location', 'other')),
  add column created_by uuid references public.profiles(id) on delete set null,
  add column purpose text check (purpose is null or char_length(purpose) between 20 and 1000),
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'archived')),
  add column privacy text not null default 'open' check (privacy in ('open', 'private')),
  add column review_note text check (review_note is null or char_length(review_note) <= 500),
  add column reviewed_at timestamptz,
  add constraint groups_name_length check (char_length(name) between 3 and 80) not valid,
  add constraint groups_description_length check (description is null or char_length(description) <= 500) not valid;
create index if not exists groups_created_by_idx on public.groups (created_by);
create index if not exists groups_status_idx on public.groups (status);

alter table public.group_members
  add column role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  add column status text not null default 'active' check (status in ('active', 'pending')),
  add column request_note text check (request_note is null or char_length(request_note) <= 300);

-- Who can see a group's posts: approved groups only; open groups to every verified member, private groups to their
-- active members. LanceNest staff see everything.
create or replace function private.can_view_group(g uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select private.is_admin() or exists (
    select 1 from public.groups gr where gr.id = g and gr.status = 'approved' and (
      (gr.privacy = 'open' and private.is_verified_member())
      or exists (select 1 from public.group_members m where m.group_id = g and m.profile_id = auth.uid() and m.status = 'active')));
$$;

create or replace function private.is_group_manager(g uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.group_members m where m.group_id = g and m.profile_id = auth.uid()
                  and m.status = 'active' and m.role in ('owner', 'moderator'));
$$;

alter policy groups_read on public.groups using (
  (private.is_verified_member() and status = 'approved') or created_by = (select auth.uid()) or private.is_admin()
);

-- Private groups: members (and pending requests) are visible to the group's own members; everyone else sees counts
-- through the page, not the list.
create or replace function private.is_group_member(g uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.group_members m where m.group_id = g and m.profile_id = auth.uid() and m.status = 'active');
$$;

alter policy group_members_read on public.group_members using (
  profile_id = (select auth.uid()) or private.is_admin()
  or (status = 'active' and exists (select 1 from public.groups gr where gr.id = group_members.group_id and gr.privacy = 'open' and gr.status = 'approved') and private.is_verified_member())
  or private.is_group_member(group_id)
);

alter policy posts_read on public.network_posts using (
  ((not hidden) or author_id = (select auth.uid()) or private.is_admin())
  and private.can_view_post(author_id, visibility)
  and (group_id is null or private.can_view_group(group_id))
);

create or replace function private.can_view_post_id(post uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.network_posts p where p.id = post and private.can_view_post(p.author_id, p.visibility)
                  and (p.group_id is null or private.can_view_group(p.group_id)));
$$;

-- Joining: approved groups only; open groups join at once, private groups as a request. Roles are set by the server.
create or replace function private.group_join_rules() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare gr record;
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  select status, privacy into gr from public.groups where id = new.group_id;
  if gr.status is distinct from 'approved' then raise exception 'group_not_open' using errcode = 'P0027'; end if;
  new.role := 'member';
  new.status := case when gr.privacy = 'private' then 'pending' else 'active' end;
  if new.status = 'active' then new.request_note := null; end if;
  return new;
end $$;

create trigger group_members_join_rules
  before insert on public.group_members
  for each row execute function private.group_join_rules();

-- Posting needs an active membership in an approved group.
create or replace function private.group_post_rules() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.group_id is not null and not exists (
       select 1 from public.group_members m join public.groups gr on gr.id = m.group_id
        where m.group_id = new.group_id and m.profile_id = new.author_id and m.status = 'active' and gr.status = 'approved') then
    raise exception 'not_group_member' using errcode = 'P0017';
  end if;
  return new;
end $$;

-- A new group request goes to LanceNest's team.
create or replace function private.notify_group_request() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (profile_id, type, title, link)
    select a.id, 'report_alert', 'A member asked to start a group: ' || left(new.name, 60), '/admin/groups'
      from public.profiles a where a.role = 'admin';
  end if;
  return new;
end $$;

create trigger groups_notify_request
  after insert on public.groups
  for each row execute function private.notify_group_request();
