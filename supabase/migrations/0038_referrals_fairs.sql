-- =====================================================================
-- Employer referral credit + virtual career fairs.
-- =====================================================================
-- Referral: when a referred company first pays, the referrer company earns one Professional month ($249).
alter table public.companies add column if not exists referral_rewarded_at timestamptz;
alter table public.companies add column if not exists referral_credit_cents integer not null default 0;

alter table public.purchases drop constraint if exists purchases_kind_check;
alter table public.purchases add constraint purchases_kind_check check (kind in ('job_boost', 'contact_credits', 'training_webinar', 'fair_booth'));

create table if not exists public.career_fairs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 4 and 140),
  description text check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.fair_booths (
  id uuid primary key default gen_random_uuid(),
  fair_id uuid not null references public.career_fairs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  pitch text check (char_length(pitch) <= 1000),
  video_url text check (video_url is null or video_url ~* '^https://'),
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  unique (fair_id, company_id)
);
create table if not exists public.fair_registrations (
  fair_id uuid not null references public.career_fairs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fair_id, profile_id)
);
alter table public.career_fairs enable row level security;
alter table public.fair_booths enable row level security;
alter table public.fair_registrations enable row level security;
create policy fairs_read on public.career_fairs for select to authenticated using (private.is_verified_member());
create policy booths_read on public.fair_booths for select to authenticated using (private.is_verified_member());
-- Booth owners may edit their pitch and video link; booths are created by the server after payment.
create policy booths_update on public.fair_booths for update to authenticated using (private.owns_company(company_id)) with check (private.owns_company(company_id));
revoke insert, delete on public.fair_booths from authenticated;
revoke update on public.fair_booths from authenticated;
grant update (pitch, video_url) on public.fair_booths to authenticated;
-- Members register themselves; companies with a booth at that fair can see who registered.
create policy fair_reg_own on public.fair_registrations for insert to authenticated with check (profile_id = auth.uid() and private.is_verified_member() and private.app_role() in ('veteran', 'admin'));
create policy fair_reg_leave on public.fair_registrations for delete to authenticated using (profile_id = auth.uid());
create policy fair_reg_read on public.fair_registrations for select to authenticated
  using (profile_id = auth.uid() or private.is_admin()
         or exists (select 1 from public.fair_booths b where b.fair_id = fair_registrations.fair_id and private.owns_company(b.company_id)));
revoke insert, update, delete on public.career_fairs from authenticated;
