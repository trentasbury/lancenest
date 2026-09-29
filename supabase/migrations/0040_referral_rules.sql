-- Referral rewards ledger: one row per referred account (idempotency) and the source of the 3-per-12-months cap.
create table if not exists public.referral_rewards (
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  cents integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_id, created_at desc);
alter table public.referral_rewards enable row level security;
create policy referral_rewards_own on public.referral_rewards for select to authenticated using (referrer_id = auth.uid());
