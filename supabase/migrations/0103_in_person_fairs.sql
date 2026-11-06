-- =====================================================================
-- 0103 (November 6, 2026): in-person and hybrid career fairs (pop-ups), alongside virtual ones.
-- A fair has a format, a venue and address, the city and state, the base it's near (a slug from lib/bases.ts), an
-- optional capacity, and the time zone its times are shown in. A full fair stops taking registrations.
-- =====================================================================

alter table public.career_fairs
  add column format text not null default 'virtual' check (format in ('virtual', 'in_person', 'hybrid')),
  add column venue_name text check (venue_name is null or char_length(venue_name) <= 140),
  add column address text check (address is null or char_length(address) <= 240),
  add column city text check (city is null or char_length(city) <= 80),
  add column state text check (state is null or state ~ '^[A-Z]{2}$'),
  add column base_slug text check (base_slug is null or base_slug ~ '^[a-z0-9-]{2,80}$'),
  add column capacity integer check (capacity is null or capacity between 1 and 100000),
  add column timezone text not null default 'America/New_York' check (char_length(timezone) <= 60),
  add constraint career_fairs_place check (format = 'virtual' or (city is not null and state is not null));
create index if not exists career_fairs_base_idx on public.career_fairs (base_slug) where base_slug is not null;
create index if not exists career_fairs_state_idx on public.career_fairs (state) where state is not null;

create or replace function private.fair_capacity() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare cap integer; taken integer;
begin
  select capacity into cap from public.career_fairs where id = new.fair_id;
  if cap is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('fair_capacity:' || new.fair_id::text));
  select count(*) into taken from public.fair_registrations where fair_id = new.fair_id;
  if taken >= cap then raise exception 'fair_full' using errcode = 'P0029'; end if;
  return new;
end $$;

create trigger fair_registrations_capacity
  before insert on public.fair_registrations
  for each row execute function private.fair_capacity();
