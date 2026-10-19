-- Help & feedback: support questions, bug reports, and ideas from members (or visitors who can't sign in).
-- The server writes every row; members can read only their own (to see status and replies).
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  name text check (char_length(name) <= 120),
  email text check (char_length(email) <= 200),
  kind text not null check (kind in ('support', 'bug', 'idea')),
  subject text not null check (char_length(subject) between 3 and 140),
  details text not null check (char_length(details) between 10 and 4000),
  page_url text check (char_length(page_url) <= 500),
  status text not null default 'new' check (status in ('new', 'in_progress', 'planned', 'done', 'closed')),
  admin_reply text check (char_length(admin_reply) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_requests_status_idx on public.support_requests (status, created_at desc);
create index if not exists support_requests_profile_idx on public.support_requests (profile_id, created_at desc);
alter table public.support_requests enable row level security;
create policy support_requests_own on public.support_requests for select to authenticated using (profile_id = auth.uid());
revoke insert, update, delete on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
