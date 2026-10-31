-- =====================================================================
-- 0088: one-time partner cards (approved October 31, 2026).
-- A base, transition office or veterans' program gets a batch of cards. Each card has its own code and QR and works
-- once (max_uses = 1, enforced under a row lock in redeem_partner_code). Batches expire 6 months after they're made.
-- transition_only (kept for later, off for every batch today): the separation date must be confirmed and within 12 months
-- (or the last 90 days), the same window as Transition Pro. Server-only (RLS on, no policies).
-- =====================================================================

create table public.partner_batches (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null check (char_length(partner_name) between 2 and 120),
  months integer not null check (months between 1 and 12),
  card_count integer not null check (card_count between 1 and 500),
  transition_only boolean not null default true,
  expires_at timestamptz not null,
  voided_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.partner_batches enable row level security;

alter table public.partner_codes add column batch_id uuid references public.partner_batches (id) on delete cascade;
alter table public.partner_codes add column transition_only boolean not null default false;
create index partner_codes_batch_idx on public.partner_codes (batch_id);
