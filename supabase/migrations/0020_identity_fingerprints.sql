-- =====================================================================
-- Identity fingerprints: a one-way HMAC of (last name, first name, DOB)
-- typed by the reviewer from the DD-214. No names or birth dates are
-- stored. Used to flag removed members and duplicate accounts.
-- Server-only (no policies): read and written with the service role.
-- =====================================================================
create table if not exists public.verified_identities (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  identity_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists verified_identities_hash_idx on public.verified_identities (identity_hash);
alter table public.verified_identities enable row level security;

create table if not exists public.banned_identities (
  identity_hash text primary key,
  reason text,
  removed_at timestamptz not null default now()
);
alter table public.banned_identities enable row level security;
