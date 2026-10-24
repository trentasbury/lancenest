-- 0075: Invoices on booked freelance jobs (while payments are arranged directly between the client and the freelancer).
-- Server-only; the contract page shows them to its client and freelancer.
create table if not exists public.contract_invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  number text not null check (char_length(number) <= 30),
  description text not null check (char_length(description) between 3 and 2000),
  amount_cents integer not null check (amount_cents between 100 and 100000000),
  due_on date,
  pay_instructions text check (pay_instructions is null or char_length(pay_instructions) <= 500),
  status text not null default 'sent' check (status in ('sent', 'paid', 'void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (freelancer_id, number)
);
create index if not exists contract_invoices_contract_idx on public.contract_invoices (contract_id);
alter table public.contract_invoices enable row level security;
revoke all on public.contract_invoices from anon, authenticated;

-- Portfolio pictures (Contra-style work pages): one image per item, from the member's own folder in LanceNest storage.
alter table public.portfolio_items add column if not exists image_url text
  check (image_url is null or image_url like ('https://ugjdzruswfzdiskvetvy.supabase.co/storage/v1/object/public/post-media/' || profile_id::text || '/%'));
