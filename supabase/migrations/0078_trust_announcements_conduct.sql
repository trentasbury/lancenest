-- 0078: Separation dates confirmed by a reviewer, yearly spouse checks, admin announcements, and blocking of
-- explicit content and slurs. Additive: new columns default to off, new tables are server-only.

-- 1) Free transition Pro only on a separation date a reviewer confirmed from orders, an LES or a DD-214.
alter table public.veteran_profiles add column if not exists separation_verified_on date;
comment on column public.veteran_profiles.separation_verified_on is 'Separation/ETS/retirement date a reviewer confirmed from documents. Server-written only.';

create table if not exists public.separation_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_date date not null,
  document_path text check (document_path is null or document_path like profile_id::text || '/%'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  confirmed_date date,
  note text check (note is null or char_length(note) <= 300),
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists separation_checks_one_pending on public.separation_checks (profile_id) where status = 'pending';
alter table public.separation_checks enable row level security;
revoke all on public.separation_checks from anon, authenticated;

-- 2) Spouses: confirmed once a year by their service member (or by documents). Missing a confirmation, or being
--    unlinked, starts a 90-day grace period; then spouse verification ends unless they re-verify. Surviving spouses
--    are marked by an admin and never expire.
alter table public.spouse_links add column if not exists confirmed_until timestamptz;
alter table public.spouse_links add column if not exists grace_until timestamptz;
alter table public.spouse_links add column if not exists reminded_at timestamptz;
alter table public.spouse_links add column if not exists surviving boolean not null default false;
-- Existing links: a year from when they were made, and never sooner than 60 days from now.
update public.spouse_links set confirmed_until = greatest(linked_at + interval '1 year', now() + interval '60 days') where confirmed_until is null;
-- Spouses verified by documents before links existed get one, so they're checked yearly too.
insert into public.spouse_links (spouse_id, sponsor_id, method, linked_at, confirmed_until)
select v.profile_id, null, 'documents', now(), now() + interval '1 year'
from public.veteran_profiles v
where v.member_type = 'spouse' and v.verification_status = 'verified'
  and not exists (select 1 from public.spouse_links l where l.spouse_id = v.profile_id)
on conflict (spouse_id) do nothing;
create index if not exists spouse_links_due_idx on public.spouse_links (confirmed_until) where not surviving;

-- A verified member who sends new documents (a spouse renewing, say) stays verified while they're reviewed;
-- a request can verify someone, but never takes verification away. Ending verification is a server decision.
create or replace function private.sync_verification_status() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.status <> 'verified' and exists (
    select 1 from public.veteran_profiles v where v.profile_id = new.profile_id and v.verification_status = 'verified'
  ) then
    return new;
  end if;
  update public.veteran_profiles set verification_status = new.status where profile_id = new.profile_id;
  update public.profiles set verified = (new.status = 'verified') where id = new.profile_id;
  return new;
end $$;

-- 3) Admin announcements: in-app notice to an audience, a phone notification, and optional email sent in daily
--    batches the email plan can handle. Server-only.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 120),
  body text check (body is null or char_length(body) <= 600),
  link text check (link is null or (char_length(link) <= 300 and link ~ '^(/[^/\\]|https://)')),
  audience text not null check (audience in ('everyone', 'members', 'service_members', 'spouses', 'employers', 'clients', 'state')),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  send_email boolean not null default false,
  recipients integer not null default 0,
  pushed integer not null default 0,
  emailed integer not null default 0,
  email_cursor uuid,
  email_done boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_email_pending_idx on public.announcements (created_at) where not email_done;
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

-- 4) Conduct: explicit sexual content, sex-work solicitation and slurs are blocked everywhere members write.
create or replace function private.explicit_signal(t text) returns boolean
language sql immutable set search_path = 'public' as $$
  select t is not null and lower(t) ~ (
    '\m(porn\w*|nudes|nude (pics?|photos?)|naked (pics?|photos?)|onlyfans|only fans|fansly|sexting|sexts?|blow ?jobs?|hand ?jobs?|cumshots?|gang ?bangs?|milfs?|hentai'
    || '|dick ?pics?|pussy|titties|tits|boobs|orgasms?|horny|erotica|camgirls?|cam girls?|nsfw|escort services?|sugar (daddy|baby|babies)'
    || '|nigg(er|ers|a|as|az)|faggots?|kikes?|wetbacks?|trann(y|ies))\M'
  );
$$;
revoke all on function private.explicit_signal(text) from public, anon, authenticated;

create or replace function private.block_explicit() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare col text;
begin
  if private.is_admin() then return new; end if;
  foreach col in array tg_argv loop
    if private.explicit_signal(to_jsonb(new) ->> col) then
      raise exception 'explicit_content' using errcode = 'P0022', hint = 'That includes language LanceNest doesn''t allow. See the Code of Conduct.';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.block_explicit() from public, anon, authenticated;

create or replace trigger conduct_posts before insert or update of body on public.network_posts
  for each row execute function private.block_explicit('body');
create or replace trigger conduct_comments before insert or update of body on public.post_comments
  for each row execute function private.block_explicit('body');
create or replace trigger conduct_messages before insert on public.messages
  for each row execute function private.block_explicit('body');
create or replace trigger conduct_profiles before insert or update of full_name, headline on public.profiles
  for each row execute function private.block_explicit('full_name', 'headline');
create or replace trigger conduct_veteran_profiles before insert or update of about on public.veteran_profiles
  for each row execute function private.block_explicit('about');
create or replace trigger conduct_proposals before insert or update of cover_letter on public.proposals
  for each row execute function private.block_explicit('cover_letter');
create or replace trigger conduct_projects before insert or update of title, description on public.freelance_projects
  for each row execute function private.block_explicit('title', 'description');
create or replace trigger conduct_services before insert or update of title, description, packages on public.service_listings
  for each row execute function private.block_explicit('title', 'description', 'packages');
create or replace trigger conduct_freelancers before insert or update of title, bio on public.freelancer_profiles
  for each row execute function private.block_explicit('title', 'bio');
create or replace trigger conduct_portfolio before insert or update of title, description on public.portfolio_items
  for each row execute function private.block_explicit('title', 'description');
create or replace trigger conduct_companies before insert or update of name, about, mission, benefits, veteran_commitment on public.companies
  for each row execute function private.block_explicit('name', 'about', 'mission', 'benefits', 'veteran_commitment');
create or replace trigger conduct_jobs before insert or update of title, description, responsibilities, qualifications, benefits on public.jobs
  for each row execute function private.block_explicit('title', 'description', 'responsibilities', 'qualifications', 'benefits');
create or replace trigger conduct_ratings before insert or update of pros, cons, employer_response on public.company_ratings
  for each row execute function private.block_explicit('pros', 'cons', 'employer_response');
create or replace trigger conduct_reviews before insert or update of body on public.reviews
  for each row execute function private.block_explicit('body');
create or replace trigger conduct_mentors before insert or update of bio on public.mentor_profiles
  for each row execute function private.block_explicit('bio');
create or replace trigger conduct_contracts before insert or update of request_note on public.contracts
  for each row execute function private.block_explicit('request_note');
