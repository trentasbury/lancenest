-- =====================================================================
-- 0090 (approved November 1, 2026): a failed payment keeps paid features for 7 days, then they pause until the
-- payment goes through. past_due_since records when a subscription first became overdue (cleared when it's paid).
-- =====================================================================
alter table public.subscriptions add column past_due_since timestamptz;
