-- =====================================================================
-- LanceNest Freelance — Release B: contracts, milestones with Protected
-- Payments (held until approval), disputes, reviews.
-- All money state is written by the server only (no client write grants).
-- =====================================================================
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.freelance_projects (id) on delete set null,
  proposal_id uuid unique references public.proposals (id) on delete set null,
  client_id uuid not null references public.profiles (id) on delete restrict,
  freelancer_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  veteran_fee_rate numeric(5, 4) not null check (veteran_fee_rate between 0 and 0.5),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> freelancer_id)
);
create index contracts_client_idx on public.contracts (client_id, created_at desc);
create index contracts_freelancer_idx on public.contracts (freelancer_id, created_at desc);
create trigger contracts_updated before update on public.contracts for each row execute function private.set_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  amount_cents integer not null check (amount_cents >= 2000),
  status text not null default 'pending' check (status in ('pending', 'funded', 'submitted', 'released', 'refunded', 'disputed', 'cancelled')),
  client_fee_cents integer not null default 0,
  platform_fee_cents integer not null default 0,     -- contract-start + small-project fees
  payment_method text check (payment_method in ('card', 'bank')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  submission_note text,
  change_request text,
  dispute_reason text,
  funded_at timestamptz, submitted_at timestamptz, released_at timestamptz, auto_release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_contract_idx on public.milestones (contract_id, created_at);
create index milestones_autorelease_idx on public.milestones (auto_release_at) where status = 'submitted';
create trigger milestones_updated before update on public.milestones for each row execute function private.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  unique (contract_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create or replace function private.is_contract_party(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contracts k where k.id = c and auth.uid() in (k.client_id, k.freelancer_id));
$$;

alter table public.contracts enable row level security;
alter table public.milestones enable row level security;
alter table public.reviews enable row level security;
create policy contracts_read on public.contracts for select to authenticated using (auth.uid() in (client_id, freelancer_id) or private.is_admin());
create policy milestones_read on public.milestones for select to authenticated using (private.is_contract_party(contract_id) or private.is_admin());
create policy reviews_read on public.reviews for select to authenticated using (private.is_verified_member() or reviewer_id = auth.uid());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and private.is_verified_member()
              and exists (select 1 from public.contracts k where k.id = contract_id and k.status = 'completed'
                          and ((k.client_id = auth.uid() and k.freelancer_id = reviewee_id) or (k.freelancer_id = auth.uid() and k.client_id = reviewee_id))));
revoke insert, update, delete on public.contracts, public.milestones from anon, authenticated;
revoke update, delete on public.reviews from anon, authenticated;
