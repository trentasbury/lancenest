-- =====================================================================
-- 0106 (November 6, 2026): the client booking fee cap goes from $249 to $499 (still 5%, at least $4.99).
-- An invoice's booking-fee top-up can be up to the new cap.
-- =====================================================================

alter table public.contract_invoices drop constraint contract_invoices_fee_due_cents_check;
alter table public.contract_invoices add constraint contract_invoices_fee_due_cents_check check (fee_due_cents >= 0 and fee_due_cents <= 49900);
