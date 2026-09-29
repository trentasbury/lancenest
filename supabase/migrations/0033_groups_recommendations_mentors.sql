-- =====================================================================
-- Round 2: groups, recommendations from fellow service members, mentorship.
-- =====================================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('branch', 'state', 'transition', 'career')),
  description text,
  created_at timestamptz not null default now()
);
insert into public.groups (slug, name, kind, description)
select lower(replace(b, ' ', '-')), b || ' veterans & service members', 'branch', 'Connect with fellow ' || b || ' service members and veterans.'
  from unnest(array['Army', 'Marine Corps', 'Navy', 'Air Force', 'Space Force', 'Coast Guard']) b
union all
select 'state-' || lower(c), n, 'state', 'Service members and veterans living or working in ' || n || '.'
  from unnest(array['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'],
              array['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']) as t(c, n)
union all
select 'separating-' || y, 'Separating in ' || y, 'transition', 'Service members leaving the military in ' || y || ': plans, SkillBridge, and job leads.' from generate_series(2026, 2030) y
union all
select 'career-' || trim(both '-' from regexp_replace(lower(c), '[^a-z0-9]+', '-', 'g')), c, 'career', 'Veterans working in or moving into ' || lower(c) || '.'
  from unnest(array['Cybersecurity & IT', 'Skilled trades', 'Law enforcement & security', 'Healthcare', 'Logistics & supply chain', 'Aviation', 'Project & program management', 'Business & finance', 'Government & federal contracting', 'Entrepreneurs & freelancers', 'Guard & Reserve']) c
on conflict (slug) do nothing;

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy groups_read on public.groups for select to authenticated using (private.is_verified_member());
create policy group_members_read on public.group_members for select to authenticated using (private.is_verified_member());
create policy group_members_join on public.group_members for insert to authenticated with check (profile_id = auth.uid() and private.is_verified_member());
create policy group_members_leave on public.group_members for delete to authenticated using (profile_id = auth.uid());

-- Group discussions reuse network posts; only members may post into a group.
alter table public.network_posts add column if not exists group_id uuid references public.groups (id) on delete cascade;
create index if not exists network_posts_group_idx on public.network_posts (group_id, created_at desc) where group_id is not null;
grant insert (group_id) on public.network_posts to authenticated;
create or replace function private.group_post_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.profile_id = new.author_id) then
    raise exception 'not_group_member' using errcode = 'P0017';
  end if;
  return new;
end $$;
revoke execute on function private.group_post_rules() from public, anon, authenticated;
drop trigger if exists network_posts_group_rules on public.network_posts;
create trigger network_posts_group_rules before insert on public.network_posts for each row execute function private.group_post_rules();

-- Recommendations: a verified service member vouches for another; shown only after the subject accepts.
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  relationship text not null check (char_length(relationship) between 3 and 140),
  body text not null check (char_length(body) between 20 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'hidden')),
  created_at timestamptz not null default now(),
  unique (author_id, subject_id),
  check (author_id <> subject_id)
);
alter table public.recommendations enable row level security;
create policy recommendations_read on public.recommendations for select to authenticated
  using ((status = 'accepted' and private.is_verified_member()) or author_id = auth.uid() or subject_id = auth.uid() or private.is_admin());
create policy recommendations_write on public.recommendations for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending' and private.is_verified_member() and private.app_role() in ('veteran', 'admin')
              and exists (select 1 from public.profiles p where p.id = subject_id and p.role in ('veteran', 'admin')));
create policy recommendations_decide on public.recommendations for update to authenticated using (subject_id = auth.uid()) with check (subject_id = auth.uid());
create policy recommendations_delete on public.recommendations for delete to authenticated using (author_id = auth.uid() or subject_id = auth.uid());
revoke update on public.recommendations from authenticated;
grant update (status) on public.recommendations to authenticated;

-- Mentorship: verified veterans volunteer as mentors in the fields they know.
create table if not exists public.mentor_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  fields text[] not null default '{}',
  bio text check (char_length(bio) <= 1000),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mentor_profiles enable row level security;
create policy mentors_read on public.mentor_profiles for select to authenticated using (private.is_verified_member());
create policy mentors_own on public.mentor_profiles for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.is_verified_member() and private.app_role() in ('veteran', 'admin'));
