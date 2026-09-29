-- =====================================================================
-- Member services (e.g. an active-duty mechanic offering car repair) and
-- member-posted freelance jobs. Hiring and payment run through contracts
-- with Protected Payments, exactly like project hires.
-- =====================================================================
create table if not exists public.service_listings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  category text not null,
  description text not null check (char_length(description) between 20 and 3000),
  price_cents integer not null check (price_cents >= 2000),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'hourly', 'starting_at')),
  delivery text not null default 'remote' check (delivery in ('remote', 'on_site', 'both')),
  service_area text check (char_length(service_area) <= 120),
  status text not null default 'active' check (status in ('active', 'paused')),
  acknowledged_at timestamptz not null default now(),   -- license + off-duty employment acknowledgment
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_listings_idx on public.service_listings (status, category);
create index if not exists service_listings_owner_idx on public.service_listings (profile_id);
alter table public.service_listings enable row level security;
create policy services_read on public.service_listings for select to authenticated
  using ((status = 'active' and private.is_verified_member()) or profile_id = auth.uid() or private.is_admin());
create policy services_own on public.service_listings for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and private.is_verified_member() and private.app_role() in ('veteran', 'admin'));

-- Contracts can start from a service request (with the client's request note).
alter table public.contracts add column if not exists service_id uuid references public.service_listings (id) on delete set null;
alter table public.contracts add column if not exists request_note text check (char_length(request_note) <= 2000);

-- Verified members (not only employers) can post freelance jobs, without a company.
drop policy if exists projects_insert on public.freelance_projects;
create policy projects_insert on public.freelance_projects for insert to authenticated
  with check (client_id = auth.uid() and private.is_verified_member() and (
    (private.app_role() = 'employer' and private.owns_company(company_id) and exists (select 1 from public.companies c where c.id = company_id and c.is_verified))
    or (private.app_role() in ('veteran', 'admin') and company_id is null)));
