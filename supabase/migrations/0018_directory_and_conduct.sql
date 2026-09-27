-- =====================================================================
-- LanceNest — member directory + professional conduct enforcement
-- Verified veterans can see each other's profiles (networking).
-- Suspended or removed members lose all access, enforced here.
-- =====================================================================
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists banned boolean not null default false;

create table if not exists public.member_strikes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level in ('warning', 'suspension', 'removal', 'reinstated')),
  reason text not null check (char_length(reason) between 3 and 500),
  report_id uuid references public.reports (id) on delete set null,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists member_strikes_profile_idx on public.member_strikes (profile_id, created_at desc);
alter table public.member_strikes enable row level security;
drop policy if exists member_strikes_read on public.member_strikes;
create policy member_strikes_read on public.member_strikes for select to authenticated using (profile_id = auth.uid() or private.is_admin());

-- Suspended/removed accounts are not "verified members" — this one function gates the whole platform.
create or replace function private.is_verified_member()
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.profiles p where p.id = auth.uid() and (p.banned or coalesce(p.suspended_until, '-infinity') > now())) then false
    else case private.app_role()
      when 'admin' then true
      when 'employer' then true
      when 'veteran' then exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.verification_status = 'verified')
      else false end
  end;
$$;

-- Verified veterans see other verified veterans (networking). Removed members are hidden from everyone but admins.
create or replace function private.can_view_veteran(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = target
      or private.is_admin()
      or (not exists (select 1 from public.profiles p where p.id = target and p.banned) and (
            exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public)
         or (private.app_role() = 'employer' and private.is_verified_member() and private.employer_can_see(target))
         or (private.app_role() = 'veteran' and private.is_verified_member()
             and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))));
$$;

drop policy if exists profiles_select_members on public.profiles;
create policy profiles_select_members on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin() or (private.is_verified_member() and not banned));
