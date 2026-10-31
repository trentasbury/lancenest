-- 0083: Post a project before signing up. A civilian fills out the project and creates a free client account in one
-- form; the project is held as a draft until they confirm their email, then published under their account (so the
-- normal posting rules, triggers and project cap all apply). Drafts are server-only.

create table if not exists public.project_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_project_id uuid references public.freelance_projects(id) on delete set null
);
alter table public.project_drafts enable row level security;
revoke all on public.project_drafts from anon, authenticated;
create index if not exists project_drafts_pending_idx on public.project_drafts (profile_id) where published_at is null;
create index if not exists project_drafts_ip_day_idx on public.project_drafts (ip_hash, created_at);
create index if not exists project_drafts_project_idx on public.project_drafts (published_project_id);

-- Screens text with the same rules the database applies on publish (sexual content and slurs, Social Security
-- numbers, contact details and off-platform payment), so a guest hears about a problem before an account exists.
-- Server key only.
create or replace function public.screen_text(t text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when t is null or btrim(t) = '' then null
    when private.explicit_signal(t) then 'explicit'
    when t ~ '(^|[^0-9])[0-9]{3}[- .][0-9]{2}[- .][0-9]{4}([^0-9]|$)' or t ~* '(ssn|social security)[^0-9]{0,25}[0-9]{9}' then 'pii'
    else private.contact_signal(t)
  end;
$$;
revoke all on function public.screen_text(text) from public, anon, authenticated;
grant execute on function public.screen_text(text) to service_role;
