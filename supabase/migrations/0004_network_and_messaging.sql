-- =====================================================================
-- LanceNest — Network feed, follows/blocks/mutes, messaging support,
-- notifications. Extends existing tables where equivalents exist:
--   replies        -> post_comments.parent_id (no separate replies table)
--   shares         -> network_posts.shared_post_id (no duplicated content)
--   life events    -> milestone fields on network_posts
--   notifications, reports, conversations, messages -> existing tables
-- =====================================================================

-- ---------- Public-safe profile facts shown on posts ----------
-- Veteran detail tables are private; these two display fields are safe to
-- show members: a verified flag and "U.S. Branch · Rank" (never MOS,
-- deployments, or clearance). Maintained by triggers, not user-editable.
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists service_summary text;

create or replace function private.sync_verification_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.veteran_profiles set verification_status = new.status where profile_id = new.profile_id;
  update public.profiles set verified = (new.status = 'verified') where id = new.profile_id;
  return new;
end $$;

update public.profiles p set verified = true
from public.veteran_profiles v where v.profile_id = p.id and v.verification_status = 'verified';

create or replace function private.refresh_service_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.profile_id, old.profile_id);
  s record;
begin
  select branch, rank into s from public.military_service
  where profile_id = target order by start_date desc nulls last, created_at desc limit 1;
  update public.profiles
     set service_summary = case when s.branch is null then null
                                else 'U.S. ' || s.branch || coalesce(' · ' || nullif(s.rank, ''), '') end
   where id = target;
  return null;
end $$;
drop trigger if exists military_service_summary on public.military_service;
create trigger military_service_summary after insert or update or delete on public.military_service
  for each row execute function private.refresh_service_summary();

update public.profiles p set service_summary = 'U.S. ' || s.branch || coalesce(' · ' || nullif(s.rank, ''), '')
from (select distinct on (profile_id) profile_id, branch, rank from public.military_service
      order by profile_id, start_date desc nulls last, created_at desc) s
where s.profile_id = p.id;

-- ---------- Follows, blocks, mutes ----------
create table public.user_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index user_follows_following_idx on public.user_follows (following_id);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table public.user_mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function private.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_follows where follower_id = a and following_id = b)
     and exists (select 1 from public.user_follows where follower_id = b and following_id = a);
$$;

-- Blocking someone removes follows in both directions.
create or replace function private.on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;
create trigger user_blocks_cleanup after insert on public.user_blocks for each row execute function private.on_block();

-- ---------- Posts ----------
create table public.network_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  post_type text not null default 'general'
    check (post_type in ('accomplishment', 'career', 'military', 'education', 'certification', 'business', 'life_event', 'general')),
  milestone text check (milestone in ('new_job', 'promotion', 'new_company', 'new_business', 'certification', 'graduation',
    'degree', 'award', 'military_promotion', 'military_retirement', 'service_anniversary', 'training',
    'career_transition', 'volunteer', 'relocation', 'personal', 'accomplishment')),
  headline text check (char_length(headline) <= 240),
  body text not null default '' check (char_length(body) <= 3000),
  title text check (char_length(title) <= 140),
  organization text check (char_length(organization) <= 140),
  location text check (char_length(location) <= 120),
  event_date date,
  visibility text not null default 'network' check (visibility in ('public', 'network', 'connections', 'private')),
  shared_post_id uuid references public.network_posts (id) on delete set null,
  is_share boolean not null default false,
  media_count integer not null default 0,
  reaction_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index network_posts_feed_idx on public.network_posts (created_at desc, id desc);
create index network_posts_author_idx on public.network_posts (author_id, created_at desc);
create index network_posts_type_idx on public.network_posts (post_type, created_at desc);
create index network_posts_shared_idx on public.network_posts (shared_post_id);
create trigger network_posts_updated before update on public.network_posts for each row execute function private.set_updated_at();

-- public = anyone; network = any signed-in member; connections = mutual follows; private = author only.
create or replace function private.can_view_post(author uuid, vis text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = author
      or private.is_admin()
      or (not private.is_blocked_between(auth.uid(), author) and (
            vis = 'public'
         or (vis = 'network' and auth.uid() is not null)
         or (vis = 'connections' and private.are_connected(auth.uid(), author))));
$$;

create or replace function private.can_view_post_id(post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.network_posts p where p.id = post and private.can_view_post(p.author_id, p.visibility));
$$;

-- Only posts that are already visible to the whole network can be re-shared (no leaking private posts).
create or replace function private.can_share(post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.network_posts p
                 where p.id = post and p.visibility in ('public', 'network') and not p.is_share
                   and private.can_view_post(p.author_id, p.visibility));
$$;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.network_posts (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, position);

create table public.post_reactions (
  post_id uuid not null references public.network_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('support', 'congratulations', 'proud', 'inspiring', 'thank_you', 'well_done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create index post_reactions_profile_idx on public.post_reactions (profile_id);
create trigger post_reactions_updated before update on public.post_reactions for each row execute function private.set_updated_at();

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.network_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.post_comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_parent_idx on public.post_comments (parent_id);
create trigger post_comments_updated before update on public.post_comments for each row execute function private.set_updated_at();

create table public.post_saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.network_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index post_saves_post_idx on public.post_saves (post_id);

-- ---------- Counters (not user-writable; kept exact by triggers) ----------
create or replace function private.bump_post_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare d integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'post_reactions' then
    update public.network_posts set reaction_count = greatest(reaction_count + d, 0) where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'post_comments' then
    update public.network_posts set comment_count = greatest(comment_count + d, 0) where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'post_media' then
    update public.network_posts set media_count = greatest(media_count + d, 0) where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'network_posts' and coalesce(new.shared_post_id, old.shared_post_id) is not null then
    update public.network_posts set share_count = greatest(share_count + d, 0) where id = coalesce(new.shared_post_id, old.shared_post_id);
  end if;
  return null;
end $$;
create trigger post_reactions_count after insert or delete on public.post_reactions for each row execute function private.bump_post_counts();
create trigger post_comments_count after insert or delete on public.post_comments for each row execute function private.bump_post_counts();
create trigger post_media_count after insert or delete on public.post_media for each row execute function private.bump_post_counts();
create trigger network_posts_share_count after insert or delete on public.network_posts for each row execute function private.bump_post_counts();

-- ---------- Notifications (existing table) ----------
create or replace function private.notify(recipient uuid, actor uuid, kind text, msg text, href text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or recipient = actor or private.is_blocked_between(recipient, actor) then return; end if;
  insert into public.notifications (profile_id, type, title, link)
  values (recipient, kind, (select coalesce(nullif(full_name, ''), 'A member') from public.profiles where id = actor) || ' ' || msg, href);
end $$;

create or replace function private.notify_mentions(actor uuid, content text, href text)
returns void language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select distinct p.id from public.profiles p
           where p.username in (select lower(m[1]) from regexp_matches(coalesce(content, ''), '@([A-Za-z0-9-]{3,60})', 'g') as m)
  loop
    perform private.notify(u.id, actor, 'mention', 'mentioned you', href);
  end loop;
end $$;

create or replace function private.on_network_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_author uuid; parent_author uuid;
begin
  if tg_table_name = 'post_reactions' then
    select author_id into post_author from public.network_posts where id = new.post_id;
    perform private.notify(post_author, new.profile_id, 'post_reaction', 'reacted to your post', '/network/' || new.post_id);
  elsif tg_table_name = 'post_comments' then
    select author_id into post_author from public.network_posts where id = new.post_id;
    if new.parent_id is null then
      perform private.notify(post_author, new.author_id, 'post_comment', 'commented on your post', '/network/' || new.post_id);
    else
      select author_id into parent_author from public.post_comments where id = new.parent_id;
      perform private.notify(parent_author, new.author_id, 'comment_reply', 'replied to your comment', '/network/' || new.post_id);
    end if;
    perform private.notify_mentions(new.author_id, new.body, '/network/' || new.post_id);
  elsif tg_table_name = 'network_posts' then
    if new.shared_post_id is not null then
      select author_id into post_author from public.network_posts where id = new.shared_post_id;
      perform private.notify(post_author, new.author_id, 'post_share', 'shared your post', '/network/' || new.id);
    end if;
    if new.visibility <> 'private' then
      perform private.notify_mentions(new.author_id, new.body, '/network/' || new.id);
    end if;
  elsif tg_table_name = 'user_follows' then
    perform private.notify(new.following_id, new.follower_id, 'follow', 'started following you', '/network/people?tab=followers');
  end if;
  return null;
end $$;
create trigger post_reactions_notify after insert on public.post_reactions for each row execute function private.on_network_activity();
create trigger post_comments_notify after insert on public.post_comments for each row execute function private.on_network_activity();
create trigger network_posts_notify after insert on public.network_posts for each row execute function private.on_network_activity();
create trigger user_follows_notify after insert on public.user_follows for each row execute function private.on_network_activity();

-- ---------- Messaging (existing tables) ----------
create or replace function private.on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  -- A blocked member can't message the person who blocked them (or vice versa).
  if exists (select 1 from public.conversation_participants cp
             where cp.conversation_id = new.conversation_id and cp.profile_id <> new.sender_id
               and private.is_blocked_between(cp.profile_id, new.sender_id)) then
    raise exception 'You can''t message this member.' using errcode = 'P0001';
  end if;
  update public.conversations set updated_at = now() where id = new.conversation_id;
  update public.conversation_participants set last_read_at = now()
   where conversation_id = new.conversation_id and profile_id = new.sender_id;
  for r in select profile_id from public.conversation_participants
           where conversation_id = new.conversation_id and profile_id <> new.sender_id loop
    perform private.notify(r.profile_id, new.sender_id, 'message', 'sent you a message', '/messages/' || new.conversation_id);
  end loop;
  return new;
end $$;
create trigger messages_on_insert before insert on public.messages for each row execute function private.on_message();

-- Trigger/internal functions are never called directly by users.
revoke execute on function private.refresh_service_summary(), private.on_block(), private.bump_post_counts(),
  private.notify(uuid, uuid, text, text, text), private.notify_mentions(uuid, text, text),
  private.on_network_activity(), private.on_message() from public, anon, authenticated;

-- ---------- Reports: new targets and reasons ----------
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('job', 'company', 'profile', 'message', 'post', 'comment'));
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'fraud', 'inappropriate', 'fake_job', 'harassment', 'fake_information', 'impersonation', 'other'));

-- ---------- Row level security ----------
alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_mutes enable row level security;
alter table public.network_posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_saves enable row level security;

create policy follows_read on public.user_follows for select to authenticated using (true);
create policy follows_insert on public.user_follows for insert to authenticated
  with check (follower_id = auth.uid() and not private.is_blocked_between(follower_id, following_id));
create policy follows_delete on public.user_follows for delete to authenticated using (follower_id = auth.uid());

create policy blocks_own on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_own on public.user_mutes for all to authenticated using (muter_id = auth.uid()) with check (muter_id = auth.uid());

create policy posts_read on public.network_posts for select using (private.can_view_post(author_id, visibility));
create policy posts_insert on public.network_posts for insert to authenticated
  with check (author_id = auth.uid() and (shared_post_id is null or private.can_share(shared_post_id)));
create policy posts_update on public.network_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.network_posts for delete to authenticated using (author_id = auth.uid());

create policy media_read on public.post_media for select using (private.can_view_post_id(post_id));
create policy media_insert on public.post_media for insert to authenticated
  with check (exists (select 1 from public.network_posts p where p.id = post_id and p.author_id = auth.uid())
              and split_part(storage_path, '/', 1) = auth.uid()::text);
create policy media_delete on public.post_media for delete to authenticated
  using (exists (select 1 from public.network_posts p where p.id = post_id and p.author_id = auth.uid()));

create policy reactions_read on public.post_reactions for select using (private.can_view_post_id(post_id));
create policy reactions_write on public.post_reactions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.can_view_post_id(post_id));

create policy comments_read on public.post_comments for select using (private.can_view_post_id(post_id));
create policy comments_insert on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and private.can_view_post_id(post_id)
              and not private.is_blocked_between(auth.uid(), (select p.author_id from public.network_posts p where p.id = post_id)));
create policy comments_update on public.post_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
-- Authors delete their own comments; post owners can remove comments on their own post.
create policy comments_delete on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.network_posts p where p.id = post_id and p.author_id = auth.uid()));

create policy saves_own on public.post_saves for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.can_view_post_id(post_id));

create policy notifications_own_delete on public.notifications for delete to authenticated using (profile_id = auth.uid());

-- Column-level protection: counters, share links, and authorship can't be edited by users.
revoke insert, update on public.network_posts from anon, authenticated;
grant insert (author_id, post_type, milestone, headline, body, title, organization, location, event_date, visibility, shared_post_id, is_share)
  on public.network_posts to authenticated;
grant update (post_type, milestone, headline, body, title, organization, location, event_date, visibility, edited_at)
  on public.network_posts to authenticated;
revoke update on public.post_comments from anon, authenticated;
grant update (body, edited_at) on public.post_comments to authenticated;
revoke update on public.post_reactions from anon, authenticated;
grant update (reaction) on public.post_reactions to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, username, headline, avatar_url, location, onboarding_completed) on public.profiles to authenticated;

-- ---------- Storage: post photos (public bucket, unguessable paths, owner-only writes) ----------
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict (id) do nothing;
create policy lancenest_post_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy lancenest_post_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
