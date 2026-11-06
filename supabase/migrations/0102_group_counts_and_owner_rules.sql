-- =====================================================================
-- 0102 (November 6, 2026): member counts for groups, owner hand-off, and join-request alerts.
-- Private groups hide their member list from non-members, so pages read counts through this function instead.
-- An owner can't simply leave (the group would have no one to run it); they hand it to a moderator first.
-- A request to join a private group alerts the group's owner and moderators.
-- =====================================================================

create or replace function public.group_member_counts(ids uuid[])
returns table (group_id uuid, members bigint)
language sql stable security definer set search_path = 'public' as $$
  select m.group_id, count(*)::bigint
    from public.group_members m join public.groups g on g.id = m.group_id
   where auth.uid() is not null
     and m.group_id = any(ids) and m.status = 'active'
     and (g.status = 'approved' or g.created_by = auth.uid() or private.is_admin())
   group by m.group_id;
$$;
grant execute on function public.group_member_counts(uuid[]) to authenticated;

create or replace function private.group_owner_stays() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is not null and old.profile_id = auth.uid() and old.role = 'owner' and old.status = 'active'
     and not private.is_admin()
     and exists (select 1 from public.groups g where g.id = old.group_id and g.status in ('approved', 'pending')) then
    raise exception 'owner_must_hand_off' using errcode = 'P0028';
  end if;
  return old;
end $$;

create trigger group_members_owner_stays
  before delete on public.group_members
  for each row execute function private.group_owner_stays();

create or replace function private.notify_group_join_request() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare gr record;
begin
  if new.status <> 'pending' then return new; end if;
  select name, slug into gr from public.groups where id = new.group_id;
  insert into public.notifications (profile_id, type, title, link)
  select m.profile_id, 'group_request', 'Someone asked to join ' || left(gr.name, 60), '/groups/' || gr.slug || '#requests'
    from public.group_members m
   where m.group_id = new.group_id and m.status = 'active' and m.role in ('owner', 'moderator')
     and m.profile_id <> new.profile_id;
  return new;
end $$;

create trigger group_members_notify_request
  after insert on public.group_members
  for each row execute function private.notify_group_join_request();
