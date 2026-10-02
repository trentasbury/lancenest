-- Verified Shortlist (packaged outcome): employer pays per role; LanceNest delivers 3 verified, interested candidates.
alter table public.purchases drop constraint if exists purchases_kind_check;
alter table public.purchases add constraint purchases_kind_check check (kind in ('job_boost', 'contact_credits', 'training_webinar', 'fair_booth', 'shortlist'));

create table if not exists public.shortlist_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  role_title text not null check (char_length(role_title) between 3 and 140),
  engagement text not null check (engagement in ('full_time', 'contract', 'contract_to_hire')),
  clearance_required text not null default 'none',
  location text check (char_length(location) <= 120),
  pay text check (char_length(pay) <= 120),
  details text check (char_length(details) <= 3000),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'sourcing', 'delivered', 'hired', 'closed')),
  rerun_used boolean not null default false,
  amount_cents integer not null default 0,
  stripe_checkout_session_id text unique,
  due_at timestamptz, delivered_at timestamptz,
  hired_profile_id uuid references public.profiles (id) on delete set null,
  placement_salary_cents integer, placement_fee_cents integer,
  created_at timestamptz not null default now()
);
create table if not exists public.shortlist_candidates (
  request_id uuid not null references public.shortlist_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (request_id, profile_id)
);
-- Contract-to-hire conversions (fee applies within 12 months of the first contract).
create table if not exists public.conversion_requests (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts (id) on delete set null,
  client_id uuid not null references public.profiles (id) on delete cascade,
  freelancer_id uuid not null references public.profiles (id) on delete cascade,
  salary_cents integer, fee_cents integer not null default 0,
  status text not null default 'new' check (status in ('new', 'invoiced', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.shortlist_requests enable row level security;
alter table public.shortlist_candidates enable row level security;
alter table public.conversion_requests enable row level security;
create policy shortlists_read on public.shortlist_requests for select to authenticated using (private.owns_company(company_id) or private.is_admin());
create policy shortlist_candidates_read on public.shortlist_candidates for select to authenticated
  using (private.is_admin() or exists (select 1 from public.shortlist_requests r where r.id = request_id and private.owns_company(r.company_id) and r.status in ('delivered', 'hired', 'closed')));
create policy conversions_read on public.conversion_requests for select to authenticated using (client_id = auth.uid() or private.is_admin());
revoke insert, update, delete on public.shortlist_requests, public.shortlist_candidates, public.conversion_requests from anon, authenticated;
