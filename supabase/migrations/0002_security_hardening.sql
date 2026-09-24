-- =====================================================================
-- LanceNest — security hardening (fixes Supabase security-advisor warnings)
-- Moves helper/trigger functions out of the API-exposed `public` schema so
-- they can't be called via /rest/v1/rpc. RLS policies and triggers point at
-- functions by internal id, so they keep working after the move.
-- =====================================================================
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.set_updated_at() set schema private;
alter function public.app_role() set schema private;
alter function public.is_admin() set schema private;
alter function public.can_view_veteran(uuid) set schema private;
alter function public.owns_company(uuid) set schema private;
alter function public.owns_job(uuid) set schema private;
alter function public.is_participant(uuid) set schema private;
alter function public.log_application_status() set schema private;
alter function public.handle_new_user() set schema private;

-- Re-point bodies that call other helpers by name (same function ids, so
-- existing policies stay attached).
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.app_role() = 'admin', false);
$$;

create or replace function private.can_view_veteran(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = target
      or private.is_admin()
      or private.app_role() = 'employer'
      or exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public);
$$;

alter function private.set_updated_at() set search_path = '';

-- Trigger functions are never called directly by users.
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.log_application_status() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
