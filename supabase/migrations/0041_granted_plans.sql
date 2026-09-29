-- Referral grants can be Pro, Pro Plus, or Federal access (pro_granted_until is the grant's end date).
alter table public.veteran_profiles add column if not exists granted_plan text check (granted_plan in ('pro', 'pro_plus', 'federal_pro'));
update public.veteran_profiles set granted_plan = 'pro' where pro_granted_until is not null and granted_plan is null;
