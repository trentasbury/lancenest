-- Run this whole file in Supabase Dashboard -> SQL Editor -> New Query -> Run

-- Profiles: one row per user, freelancer or client
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('freelancer', 'client')),
  headline text,
  bio text,
  skills text[],
  hourly_rate numeric,
  avatar_url text,
  stripe_account_id text,        -- freelancer's Stripe Connect account
  stripe_onboarded boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are publicly viewable"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- Portfolio items on a freelancer profile
create table portfolio_items (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  image_url text,
  link_url text,
  created_at timestamptz default now()
);

alter table portfolio_items enable row level security;

create policy "Portfolio items are publicly viewable"
  on portfolio_items for select using (true);

create policy "Owners manage their portfolio items"
  on portfolio_items for all using (auth.uid() = profile_id);

-- Jobs / hires between a client and a freelancer
create table jobs (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) not null,
  freelancer_id uuid references profiles(id) not null,
  title text not null,
  description text,
  amount_cents integer not null,          -- total price client pays
  commission_cents integer not null,       -- platform's cut, calculated at creation
  status text not null default 'pending' check (status in ('pending', 'paid', 'completed', 'cancelled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table jobs enable row level security;

create policy "Involved parties can view their jobs"
  on jobs for select using (auth.uid() = client_id or auth.uid() = freelancer_id);

create policy "Clients can create jobs"
  on jobs for insert with check (auth.uid() = client_id);

create policy "Involved parties can update their jobs"
  on jobs for update using (auth.uid() = client_id or auth.uid() = freelancer_id);

-- Reviews left after a completed job
create table reviews (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) not null,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

alter table reviews enable row level security;

create policy "Reviews are publicly viewable"
  on reviews for select using (true);

create policy "Reviewer can create a review"
  on reviews for insert with check (auth.uid() = reviewer_id);

-- Simple messages between a client and freelancer on a job
create table messages (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) not null,
  sender_id uuid references profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create policy "Involved parties can view messages"
  on messages for select using (
    exists (
      select 1 from jobs
      where jobs.id = messages.job_id
      and (jobs.client_id = auth.uid() or jobs.freelancer_id = auth.uid())
    )
  );

create policy "Involved parties can send messages"
  on messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from jobs
      where jobs.id = messages.job_id
      and (jobs.client_id = auth.uid() or jobs.freelancer_id = auth.uid())
    )
  );

-- Index for the public directory search
create index profiles_role_idx on profiles(role);
create index profiles_skills_idx on profiles using gin(skills);
