-- "Book a call" requests from Federal and Enterprise prospects (server-only table).
create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 200),
  company text not null check (char_length(company) between 2 and 160),
  size text, plan text, needs text check (char_length(needs) <= 2000), times text check (char_length(times) <= 300),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.sales_leads enable row level security;
