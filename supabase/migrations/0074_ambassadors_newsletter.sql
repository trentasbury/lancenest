-- 0074: Base ambassadors and the public weekly newsletter. Additive; both tables are server-only.
create table if not exists public.ambassadors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  installation text not null check (char_length(installation) between 2 and 120),
  role_note text check (role_note is null or char_length(role_note) <= 300),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
alter table public.ambassadors enable row level security;

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  token_hash text not null,
  source text check (source is null or char_length(source) <= 60),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_sent_at timestamptz
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.ambassadors, public.newsletter_subscribers from anon, authenticated;
