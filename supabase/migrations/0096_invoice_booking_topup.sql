-- =====================================================================
-- 0096 (approved November 1, 2026): the booking fee follows what's actually invoiced.
-- The booking fee is 5% of the job (at least $4.99, at most $249). If a freelancer's invoices on a booked job add up
-- to more than the fee already covers, the difference is paid first (by whoever paid the booking fee: the client, or
-- the freelancer if they cover it), then the invoice goes out. A held invoice waits for that payment.
-- =====================================================================

alter table public.contract_invoices
  add column held boolean not null default false,
  add column fee_due_cents integer not null default 0 check (fee_due_cents >= 0 and fee_due_cents <= 24900),
  add column fee_paid_cents integer not null default 0 check (fee_paid_cents >= 0),
  add column fee_paid_at timestamptz,
  add column fee_checkout_session_id text;
