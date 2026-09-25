-- =====================================================================
-- LanceNest — Stripe billing, employer plans, job boosts, extra job slots
-- Plans/entitlements are written ONLY by the server (service role) after
-- Stripe confirms payment. Users can never set them.
-- =====================================================================
alter table public.companies add column if not exists stripe_customer_id text;
alter table public.companies add column if not exists extra_job_slots integer not null default 0;
alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies add constraint companies_plan_check check (plan in ('free', 'professional', 'federal', 'enterprise'));

alter table public.veteran_profiles add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'federal_pro'));
alter table public.profiles add column if not exists stripe_customer_id text;

alter table public.jobs add column if not exists featured_until timestamptz;
create index if not exists jobs_featured_idx on public.jobs (featured_until desc) where featured_until is not null;

-- Subscriptions now cover employer plans, veteran plans, and job-slot add-ons.
alter table public.subscriptions alter column company_id drop not null;
alter table public.subscriptions add column if not exists profile_id uuid references public.profiles (id) on delete cascade;
alter table public.subscriptions add column if not exists kind text not null default 'plan';
alter table public.subscriptions drop constraint if exists subscriptions_kind_check;
alter table public.subscriptions add constraint subscriptions_kind_check check (kind in ('plan', 'job_slot'));
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free', 'professional', 'federal', 'enterprise', 'veteran_pro', 'veteran_federal_pro', 'job_slot'));
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'));
alter table public.subscriptions drop constraint if exists subscriptions_owner_check;
alter table public.subscriptions add constraint subscriptions_owner_check check (company_id is not null or profile_id is not null);
create unique index if not exists subscriptions_stripe_idx on public.subscriptions (stripe_subscription_id);
create index if not exists subscriptions_profile_idx on public.subscriptions (profile_id);

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (profile_id = auth.uid() or private.owns_company(company_id) or private.is_admin());

-- One-time purchases (job boosts now; contact credits later).
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('job_boost', 'contact_credits')),
  job_id uuid references public.jobs (id) on delete set null,
  amount_cents integer not null,
  stripe_checkout_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists purchases_company_idx on public.purchases (company_id, created_at desc);
alter table public.purchases enable row level security;
drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases for select to authenticated
  using (profile_id = auth.uid() or private.owns_company(company_id) or private.is_admin());

-- Webhook idempotency: each Stripe event is processed once.
create table if not exists public.billing_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

-- Free plan: 2 open jobs, plus any extra slots purchased.
create or replace function private.enforce_job_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  open_count integer;
begin
  if auth.uid() is null or new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' then return new; end if;
  select plan, extra_job_slots into c from public.companies where id = new.company_id;
  if c.plan = 'free' then
    select count(*) into open_count from public.jobs where company_id = new.company_id and status = 'open' and id <> new.id;
    if open_count >= 2 + coalesce(c.extra_job_slots, 0) then
      raise exception 'job_limit' using errcode = 'P0003', hint = 'Free plan open-job limit reached.';
    end if;
  end if;
  return new;
end $$;
