-- =====================================================================
-- LanceNest — verification workflow + veteran plan waitlist
-- =====================================================================

-- Keep veteran_profiles.verification_status in sync with the latest request.
-- Users can't set their own status; this runs as the table owner.
create or replace function private.sync_verification_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.veteran_profiles set verification_status = new.status where profile_id = new.profile_id;
  return new;
end $$;
revoke execute on function private.sync_verification_status() from public, anon, authenticated;

drop trigger if exists verification_requests_sync on public.verification_requests;
create trigger verification_requests_sync
  after insert or update of status on public.verification_requests
  for each row execute function private.sync_verification_status();

-- Only one open request per member at a time.
create unique index if not exists verification_one_pending
  on public.verification_requests (profile_id) where status = 'pending';

-- Interest list for veteran plans (billing arrives in a later phase).
create table if not exists public.plan_waitlist (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('veteran_pro', 'veteran_federal_pro')),
  created_at timestamptz not null default now(),
  primary key (profile_id, plan)
);
alter table public.plan_waitlist enable row level security;
drop policy if exists plan_waitlist_own on public.plan_waitlist;
create policy plan_waitlist_own on public.plan_waitlist for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
