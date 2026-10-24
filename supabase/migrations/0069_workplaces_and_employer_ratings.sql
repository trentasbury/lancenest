-- 0069: "Veterans who work here" and employer ratings from verified veterans. Additive only.
-- Both tables are server-only (no API access): the site reads them with the server key and shows employers only what
-- they may see (never who wrote a rating).

create table if not exists public.company_people (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  is_current boolean not null default true,
  title text check (title is null or char_length(title) <= 120),
  open_to_referrals boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (profile_id, company_id)
);
create index if not exists company_people_company_idx on public.company_people (company_id);
alter table public.company_people enable row level security;

create table if not exists public.company_ratings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  overall smallint not null check (overall between 1 and 5),
  veteran_support smallint not null check (veteran_support between 1 and 5),
  recommend boolean not null,
  pros text check (pros is null or char_length(pros) <= 1000),
  cons text check (cons is null or char_length(cons) <= 1000),
  was_current boolean not null default true,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  employer_response text check (employer_response is null or char_length(employer_response) <= 1000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_id)
);
create index if not exists company_ratings_company_idx on public.company_ratings (company_id) where status = 'visible';
alter table public.company_ratings enable row level security;
revoke all on public.company_people, public.company_ratings from anon, authenticated;

-- Ratings can be reported like posts and jobs.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('job', 'company', 'profile', 'message', 'post', 'comment', 'rating'));
