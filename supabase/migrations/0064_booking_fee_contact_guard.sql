-- 0064: Freelance booking fee, contact-info guard, licensed-trade guard, and privacy lockdowns.
-- Additive only: new columns, functions, triggers, a tightened insert policy, and narrower column grants.

-- 1) Booking fee. The client pays LanceNest a booking fee when they hire (tiers in src/lib/feeMath.ts).
--    It is LanceNest's own fee, collected before the job is booked, so it can't be skipped by paying the freelancer in cash.
alter table public.contracts
  add column if not exists booking_status text not null default 'not_required'
    check (booking_status in ('not_required', 'awaiting_payment', 'paid')),
  add column if not exists booking_fee_cents integer check (booking_fee_cents is null or booking_fee_cents >= 0),
  add column if not exists booking_paid_at timestamptz,
  add column if not exists booking_checkout_session_id text unique,
  add column if not exists on_site boolean not null default false;
create index if not exists contracts_awaiting_booking_idx on public.contracts (client_id) where booking_status = 'awaiting_payment';

-- 2) Contact details (phone, email, links, payment apps, "pay cash / off the app") — returns what it found, or null.
create or replace function private.contact_signal(txt text) returns text
language plpgsql immutable set search_path = '' as $$
declare t text;
begin
  if txt is null or btrim(txt) = '' then return null; end if;
  t := lower(txt);
  t := regexp_replace(t, '(https?://)?(www\.)?lancenest\.com[^\s]*', ' ', 'g');
  t := regexp_replace(t, '\m(asp|vb|ado)\.net\M', ' ', 'g');
  if t ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return 'email'; end if;
  if t ~ '\m(gmail|yahoo|hotmail|outlook|icloud|protonmail)\M' or t ~ '\mdot\s*(com|net|org)\M' or t ~ '[\(\[]\s*at\s*[\)\]]' then return 'email'; end if;
  if t ~ '(^|[^0-9$,.])(\+?1[\s.-]?)?\(?[2-9][0-9]{2}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}([^0-9]|$)' then return 'phone'; end if;
  if t ~ '(https?://|www\.)' or t ~ '\m[a-z0-9-]+\.(com|net|org|io|co|us|me|biz|info|app|dev|ly|link|page|site)\M' then return 'link'; end if;
  if t ~ '\m(venmo|zelle|cash\s?app)\M' or t ~ '(^|\s)\$[a-z][a-z0-9_]{2,}' then return 'payment_app'; end if;
  if t ~ '\m(text|call|email|e-mail|message|dm|ping|reach)\s+me\s+(at|on|directly)\M'
     or t ~ '\mmy\s+(cell|phone|number|email|e-mail|ig|insta|instagram|snap|snapchat|whatsapp|telegram)\M'
     or t ~ '(^|\s)@[a-z0-9_.]{3,}' then return 'contact'; end if;
  if t ~ '\m(off|outside)\s+(of\s+)?(the\s+)?(app|platform|site|website|lancenest)\M'
     or t ~ '\mpay\s+(me\s+|you\s+)?(in\s+)?cash\M' or t ~ '\mcash\s+(only|deal|payment|job)\M'
     or t ~ '\m(skip|avoid|dodge)\s+(the\s+)?(fee|fees|app|platform)\M' then return 'off_platform'; end if;
  return null;
end $$;
revoke all on function private.contact_signal(text) from public;

-- Freelance listings, proposals, profiles and hire requests never carry contact details (they're shared after booking).
create or replace function private.block_contact_info() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare col text; sig text;
begin
  if private.is_admin() then return new; end if;
  foreach col in array tg_argv loop
    sig := private.contact_signal(to_jsonb(new) ->> col);
    if sig is not null then
      raise exception 'contact_info' using errcode = 'P0017', hint = sig;
    end if;
  end loop;
  return new;
end $$;

create or replace trigger contact_guard_proposals before insert or update of cover_letter, timeline on public.proposals
  for each row execute function private.block_contact_info('cover_letter', 'timeline');
create or replace trigger contact_guard_projects before insert or update of title, description, work_location on public.freelance_projects
  for each row execute function private.block_contact_info('title', 'description', 'work_location');
create or replace trigger contact_guard_services before insert or update of title, description, service_area on public.service_listings
  for each row execute function private.block_contact_info('title', 'description', 'service_area');
create or replace trigger contact_guard_freelancers before insert or update of title, bio on public.freelancer_profiles
  for each row execute function private.block_contact_info('title', 'bio');
create or replace trigger contact_guard_portfolio before insert or update of title, description on public.portfolio_items
  for each row execute function private.block_contact_info('title', 'description');
create or replace trigger contact_guard_contracts before insert or update of request_note on public.contracts
  for each row execute function private.block_contact_info('request_note');

-- Messages: blocked only between a client (employer) and a freelancer who have freelance dealings and no booked job yet.
-- Unlocked by a paid booking, a funded Protected Payment, or the member having applied to one of the employer's jobs.
create or replace function private.freelance_contact_locked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  with r as (select id, role from public.profiles where id in (a, b)),
       e as (select id from r where role = 'employer' limit 1),
       v as (select id from r where role = 'veteran' limit 1)
  select exists (select 1 from e) and exists (select 1 from v)
    and not exists (
      select 1 from public.contracts k
       where k.client_id = (select id from e) and k.freelancer_id = (select id from v) and k.status <> 'cancelled'
         and (k.booking_status = 'paid'
              or (k.booking_status = 'not_required' and exists (select 1 from public.milestones m where m.contract_id = k.id and m.funded_at is not null))))
    and not exists (
      select 1 from public.applications ap
        join public.jobs j on j.id = ap.job_id
        join public.companies c on c.id = j.company_id
       where ap.profile_id = (select id from v) and ap.source = 'lancenest'
         and (c.owner_id = (select id from e)
              or exists (select 1 from public.company_members cm where cm.company_id = c.id and cm.profile_id = (select id from e))))
    and (
      exists (select 1 from public.proposals p join public.freelance_projects fp on fp.id = p.project_id
               where p.freelancer_id = (select id from v) and fp.client_id = (select id from e))
      or exists (select 1 from public.contracts k where k.client_id = (select id from e) and k.freelancer_id = (select id from v) and k.booking_status = 'awaiting_payment')
      or exists (select 1 from public.service_listings s where s.profile_id = (select id from v) and s.status = 'active'));
$$;
revoke all on function private.freelance_contact_locked(uuid, uuid) from public;

create or replace function private.guard_message_contact() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare sig text;
begin
  sig := private.contact_signal(new.body);
  if sig is null then return new; end if;
  if exists (select 1 from public.conversation_participants cp
              where cp.conversation_id = new.conversation_id and cp.profile_id <> new.sender_id
                and private.freelance_contact_locked(new.sender_id, cp.profile_id)) then
    raise exception 'contact_info' using errcode = 'P0017', hint = sig;
  end if;
  return new;
end $$;
create or replace trigger contact_guard_messages before insert on public.messages
  for each row execute function private.guard_message_contact();

-- 3) Licensed trades stay closed until license verification ships (the app hides them; this stops direct API inserts).
create or replace function private.block_licensed_trades() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.category in ('HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors')
     and not private.is_admin() then
    raise exception 'licensed_trade' using errcode = 'P0018', hint = 'Licensed trades open when license verification launches.';
  end if;
  return new;
end $$;
create or replace trigger licensed_trades_services before insert or update of category on public.service_listings
  for each row execute function private.block_licensed_trades();
create or replace trigger licensed_trades_projects before insert or update of category on public.freelance_projects
  for each row execute function private.block_licensed_trades();

-- 4) Verification requests may only point at the member's own uploaded files, and can't arrive pre-reviewed.
alter policy verification_insert_own on public.verification_requests
  with check (
    profile_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and reviewed_at is null
    and (document_path is null or split_part(document_path, '/', 1) = (select auth.uid())::text)
    and (id_document_path is null or split_part(id_document_path, '/', 1) = (select auth.uid())::text)
  );

-- 5) Privacy: billing/payout IDs and internal flags are server-only; salary expectations aren't public.
revoke select on public.profiles from anon, authenticated;
grant select (id, role, full_name, username, headline, avatar_url, location, onboarding_completed, created_at, updated_at,
              verified, service_summary, suspended_until, banned, last_active_at, referred_by, referral_rewarded_at, email_digest)
  on public.profiles to authenticated;
grant select (id, role, full_name, username, headline, avatar_url, location, verified, service_summary, created_at, updated_at)
  on public.profiles to anon;

revoke select on public.freelancer_profiles from anon, authenticated;
grant select (profile_id, title, bio, hourly_rate, available, clearance_work, vosb, sdvosb, sam_uei, payouts_enabled, created_at, updated_at)
  on public.freelancer_profiles to authenticated;

revoke select on public.veteran_profiles from anon;
grant select (profile_id, about, city, state, desired_titles, industries, work_arrangements, employment_types, willing_to_relocate,
              clearance_level, verification_status, is_public, created_at, updated_at, plan, open_to_transition_hiring,
              skillbridge_interest, clearance_status, availability)
  on public.veteran_profiles to anon;
