-- Public Safety rate: 30% off Professional/Federal for government police, sheriff, corrections, fire, and EMS agencies.
-- Eligibility is approved by a LanceNest admin; companies cannot set it themselves (no column grants).
alter table public.companies add column if not exists public_safety_status text not null default 'none';
alter table public.companies drop constraint if exists companies_public_safety_status_check;
alter table public.companies add constraint companies_public_safety_status_check check (public_safety_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.companies add column if not exists public_safety_details jsonb;
