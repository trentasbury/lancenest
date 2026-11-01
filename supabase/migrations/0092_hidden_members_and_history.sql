-- =====================================================================
-- 0092 (deep audit, November 1, 2026)
-- 1) members_hiding_me() told an employer exactly which members hid their profile from that company (for example,
--    their own employees who are job hunting). The app now works this out on the server and never sends the list;
--    the function returns nothing (it stays only so older code can't break).
-- 2) identity_history: when a verified member deletes their account, any warnings or suspensions on it are kept
--    against their identity fingerprint (one-way, unreadable) and carried over if the same person verifies a new
--    account, so deleting and re-joining doesn't wipe a record. Server-only.
-- =====================================================================

create or replace function public.members_hiding_me()
returns setof uuid
language sql stable security definer set search_path = 'public' as $$
  select null::uuid where false;
$$;

create table public.identity_history (
  identity_hash text primary key,
  strikes jsonb not null default '[]'::jsonb,
  deleted_at timestamptz not null default now()
);
alter table public.identity_history enable row level security;
comment on table public.identity_history is 'Moderation record (warnings/suspensions) of deleted accounts, keyed by the verified identity fingerprint. Server-only.';
