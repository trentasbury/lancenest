-- 0072: License and certificate checks, and licensed trades (HVAC, electrical, plumbing, construction, roofing) reopened
-- for members with a verified, unexpired license in that trade. Additive; the trade guard is replaced, not dropped.

create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('license', 'certificate')),
  name text not null check (char_length(name) between 2 and 120),
  trade text check (trade is null or trade in ('HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors')),
  issuer text check (issuer is null or char_length(issuer) <= 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  number text check (number is null or char_length(number) <= 60),
  expires_on date,
  document_path text check (document_path is null or document_path like (profile_id::text || '/%')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'expired')),
  note text check (note is null or char_length(note) <= 300),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'certificate' or (trade is not null and state is not null and number is not null))
);
create index if not exists credentials_profile_idx on public.credentials (profile_id);
create index if not exists credentials_pending_idx on public.credentials (created_at) where status = 'pending';
alter table public.credentials enable row level security;
revoke all on public.credentials from anon, authenticated;
-- Server-only: the site shows verified credentials (never license numbers) and runs the review queue.

create or replace function private.has_trade_license(member uuid, trade_name text) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.credentials c where c.profile_id = member and c.kind = 'license' and c.trade = trade_name
                 and c.status = 'verified' and (c.expires_on is null or c.expires_on >= current_date));
$$;
revoke all on function private.has_trade_license(uuid, text) from public;

-- Services in a licensed trade need the member's verified license for that trade. Clients may post projects in any
-- trade; only licensed members can send proposals on licensed-trade projects (next trigger).
create or replace function private.block_licensed_trades() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.category in ('HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors') and not private.is_admin() then
    if tg_table_name = 'service_listings' and not private.has_trade_license(new.profile_id, new.category) then
      raise exception 'licensed_trade' using errcode = 'P0018', hint = 'Add your license for this trade and get it verified first.';
    end if;
  end if;
  return new;
end $$;

create or replace function private.licensed_proposals() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare cat text;
begin
  select category into cat from public.freelance_projects where id = new.project_id;
  if cat in ('HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors')
     and not private.has_trade_license(new.freelancer_id, cat) and not private.is_admin() then
    raise exception 'licensed_trade' using errcode = 'P0018', hint = 'This project needs a verified license for its trade.';
  end if;
  return new;
end $$;
create or replace trigger licensed_trades_proposals before insert on public.proposals
  for each row execute function private.licensed_proposals();
