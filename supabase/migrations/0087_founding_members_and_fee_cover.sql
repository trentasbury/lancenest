-- =====================================================================
-- 0087: Founding Members and "the pro covers the booking fee".
-- 1) founding_members: the first 100 verified members (service members, veterans and spouses). Each gets 6 months
--    of Pro free, then $99 for their first paid year of Pro (annual). Seats 1-100 are enforced here, so two
--    approvals at the same moment can't create a 101st. Server-only.
-- 2) A freelancer can choose to pay the booking fee themselves on a service listing or a proposal, so the client
--    sees "No booking fee". The contract records who pays (booking_fee_payer).
-- =====================================================================

create table public.founding_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  seat integer not null unique check (seat between 1 and 100),
  granted_at timestamptz not null default now()
);
alter table public.founding_members enable row level security;

alter table public.service_listings add column covers_booking_fee boolean not null default false;
alter table public.proposals add column covers_booking_fee boolean not null default false;
alter table public.contracts add column booking_fee_payer text not null default 'client'
  check (booking_fee_payer in ('client', 'freelancer'));

-- Proposals use column-level grants: the freelancer sets this when sending a proposal (not editable afterwards,
-- so it can't be switched off after the client has seen "No booking fee"). Service listings already allow
-- the owner to edit every column of their own listing.
grant insert (covers_booking_fee) on public.proposals to authenticated;
