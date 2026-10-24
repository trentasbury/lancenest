-- 0073: AI helpers (résumé writer, job fit). One row per use, for monthly limits. Server-only.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('resume', 'job_fit')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_profile_month_idx on public.ai_usage (profile_id, created_at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
