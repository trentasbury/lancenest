-- 0068: Free Pro for people leaving the service, and military spouses as members. Additive only.

-- 1) Member type. Spouses are members (role 'veteran' inside the app) verified through their service member or documents.
alter table public.veteran_profiles add column if not exists member_type text not null default 'service_member'
  check (member_type in ('service_member', 'spouse'));
comment on column public.veteran_profiles.member_type is 'service_member or spouse. Set at sign-up; only the server changes it.';
-- Members can read it (it shows as a badge) but not change it: no update grant.

-- New accounts: the sign-up form may say member_type = spouse (anything else is a service member).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = 'public' as $$
declare
  safe_role text := case when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer' else 'veteran' end;
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

-- 2) One-time perks a member has received (free transition Pro now; ambassador rewards later). Server-only.
create table if not exists public.member_grants (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('transition_pro')),
  granted_at timestamptz not null default now(),
  primary key (profile_id, kind)
);
alter table public.member_grants enable row level security;

-- 3) Spouse verification through a verified service member: the member sends a one-time invite link; the spouse accepts.
create table if not exists public.spouse_invites (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz
);
create index if not exists spouse_invites_sponsor_idx on public.spouse_invites (sponsor_id);
alter table public.spouse_invites enable row level security;

create table if not exists public.spouse_links (
  spouse_id uuid primary key references public.profiles(id) on delete cascade,
  sponsor_id uuid references public.profiles(id) on delete set null,
  method text not null check (method in ('sponsor_invite', 'documents')),
  linked_at timestamptz not null default now()
);
create index if not exists spouse_links_sponsor_idx on public.spouse_links (sponsor_id);
alter table public.spouse_links enable row level security;
-- No policies on these three tables: only the server (after its own checks) reads or writes them.
revoke all on public.member_grants, public.spouse_invites, public.spouse_links from anon, authenticated;
