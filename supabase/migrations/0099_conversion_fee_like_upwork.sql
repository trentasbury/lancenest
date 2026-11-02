-- =====================================================================
-- 0099 (approved November 2, 2026): the conversion fee matches Upwork's. Within 24 months of meeting on LanceNest,
-- a client and freelancer can move their relationship off LanceNest (a full-time hire, or keep working together
-- outside LanceNest) by paying 13.5% of the freelancer's expected earnings from that client over the next 12 months,
-- less booking fees the client paid on work with that freelancer in the last 12 months, at least $1,000. No fee after
-- 24 months. Still behind CONVERSION_FEES_ENABLED (off until the attorney clears it).
-- =====================================================================
alter table public.conversion_requests
  add column kind text not null default 'full_time' check (kind in ('full_time', 'off_platform')),
  add column estimate_cents integer,
  add column discount_cents integer not null default 0 check (discount_cents >= 0);
comment on column public.conversion_requests.estimate_cents is 'What the freelancer is expected to earn from this client over the next 12 months (first-year salary for a full-time hire).';
