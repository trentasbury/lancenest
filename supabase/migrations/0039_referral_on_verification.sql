-- Referral credit is earned once per referred person or company, when they're verified.
alter table public.profiles add column if not exists referral_rewarded_at timestamptz;
