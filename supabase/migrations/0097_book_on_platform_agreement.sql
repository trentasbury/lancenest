-- =====================================================================
-- 0097 (approved November 2, 2026): "Book it on LanceNest" agreement, like Upwork's.
-- Freelancers agree once before their first proposal or live listing; clients and employers agree once before their
-- first booking. Each agreement is kept with its wording version and time (evidence if someone takes a client off the
-- platform to avoid fees). Server-only table; the database also refuses proposals and live listings without it.
-- =====================================================================

create table public.platform_agreements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('freelancer', 'client')),
  version text not null,
  agreed_at timestamptz not null default now(),
  primary key (profile_id, side, version)
);
alter table public.platform_agreements enable row level security;
comment on table public.platform_agreements is 'Who agreed to book work found on LanceNest through LanceNest, which wording, and when. Server-only.';

create or replace function private.require_platform_agreement() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  -- Listings: only when one goes live (a new active listing, or a paused one switched back on).
  if tg_table_name = 'service_listings'
     and not (new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active')) then
    return new;
  end if;
  if not exists (select 1 from public.platform_agreements a where a.profile_id = auth.uid() and a.side = 'freelancer') then
    raise exception 'platform_agreement' using errcode = 'P0026', hint = 'Agree to book work you find on LanceNest through LanceNest first.';
  end if;
  return new;
end $$;

create trigger proposals_platform_agreement
  before insert on public.proposals
  for each row execute function private.require_platform_agreement();

create trigger services_platform_agreement
  before insert or update of status on public.service_listings
  for each row execute function private.require_platform_agreement();
