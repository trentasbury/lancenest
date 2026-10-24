-- 0071: Job import from employers' hiring systems (Greenhouse, Lever, Ashby, XML feeds). Additive only.
alter table public.jobs
  add column if not exists external_source text check (external_source is null or external_source in ('greenhouse', 'lever', 'ashby', 'xml')),
  add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200);
create unique index if not exists jobs_external_unique on public.jobs (company_id, external_source, external_id) where external_id is not null;
grant insert (external_source, external_id) on public.jobs to authenticated;

-- Where each company's jobs come from, for the optional daily sync. Server-only.
create table if not exists public.job_feeds (
  company_id uuid primary key references public.companies(id) on delete cascade,
  kind text not null check (kind in ('greenhouse', 'lever', 'ashby', 'xml')),
  source text not null check (char_length(source) between 2 and 500),
  auto_sync boolean not null default false,
  last_synced_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now()
);
alter table public.job_feeds enable row level security;
revoke all on public.job_feeds from anon, authenticated;
