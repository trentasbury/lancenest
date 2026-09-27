-- Veteran plans: Free, Pro, Pro Plus, Federal (plan key federal_pro kept for continuity).
alter table public.veteran_profiles drop constraint if exists veteran_profiles_plan_check;
alter table public.veteran_profiles add constraint veteran_profiles_plan_check check (plan in ('free', 'pro', 'pro_plus', 'federal_pro'));
alter table public.plan_waitlist drop constraint if exists plan_waitlist_plan_check;
alter table public.plan_waitlist add constraint plan_waitlist_plan_check check (plan in ('veteran_pro', 'veteran_pro_plus', 'veteran_federal_pro'));
