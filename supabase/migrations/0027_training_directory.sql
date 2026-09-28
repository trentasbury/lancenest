-- =====================================================================
-- Training & Certifications directory: partners pay flat fees (listing,
-- featured, sponsored info sessions) — never per enrollment (GI Bill rules).
-- =====================================================================
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in
  ('free', 'professional', 'federal', 'enterprise', 'veteran_pro', 'veteran_pro_plus', 'veteran_federal_pro', 'job_slot', 'training', 'training_featured'));
alter table public.purchases drop constraint if exists purchases_kind_check;
alter table public.purchases add constraint purchases_kind_check check (kind in ('job_boost', 'contact_credits', 'training_webinar'));

-- Set by the server from active subscriptions only.
alter table public.companies add column if not exists training_listing_active boolean not null default false;
alter table public.companies add column if not exists training_featured boolean not null default false;

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 140),
  category text not null,
  description text not null check (char_length(description) between 20 and 4000),
  format text not null default 'online' check (format in ('online', 'in_person', 'hybrid')),
  location text check (char_length(location) <= 120),
  duration text check (char_length(duration) <= 60),
  cost text check (char_length(cost) <= 80),
  gi_bill_approved boolean not null default false,
  url text not null check (url ~* '^https://'),
  status text not null default 'draft' check (status in ('draft', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_programs_idx on public.training_programs (status, category);
create trigger training_programs_updated before update on public.training_programs for each row execute function private.set_updated_at();

create table public.training_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 140),
  starts_at timestamptz not null,
  url text not null check (url ~* '^https://'),
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now()
);
create index training_events_idx on public.training_events (starts_at);

-- Programs go live only while the partner's listing subscription is active; links must be on the company's verified domain.
create or replace function private.training_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare host text; site text; active boolean;
begin
  if auth.uid() is null then return new; end if;
  select lower(regexp_replace(substring(c.verification_details ->> 'website' from '^https?://([^/:?#]+)'), '^www\.', '')), c.training_listing_active and c.is_verified
    into site, active from public.companies c where c.id = new.company_id;
  host := lower(substring(new.url from '^https://([^/:?#]+)'));
  if host is null or site is null or not (host = site or host like '%.' || site) then
    raise exception 'training_url_domain' using errcode = 'P0012', hint = 'Program links must be on your verified company website.';
  end if;
  if new.status = 'live' and not coalesce(active, false) then
    raise exception 'training_listing_inactive' using errcode = 'P0011', hint = 'An active listing subscription is required to publish programs.';
  end if;
  return new;
end $$;
revoke execute on function private.training_rules() from public, anon, authenticated;
create trigger training_programs_rules before insert or update on public.training_programs for each row execute function private.training_rules();

alter table public.training_programs enable row level security;
alter table public.training_events enable row level security;
create policy training_programs_read on public.training_programs for select to authenticated
  using (private.owns_company(company_id) or private.is_admin()
         or (status = 'live' and private.is_verified_member()
             and exists (select 1 from public.companies c where c.id = company_id and c.training_listing_active and c.is_verified)));
create policy training_programs_write on public.training_programs for all to authenticated
  using (private.owns_company(company_id)) with check (private.owns_company(company_id) and private.app_role() = 'employer');
create policy training_events_read on public.training_events for select to authenticated
  using (private.owns_company(company_id) or private.is_admin() or (private.is_verified_member() and starts_at >= now() - interval '1 day'));
revoke insert, update, delete on public.training_events from anon, authenticated;
