-- The founder's personal welcome email goes out once, the morning after a member is verified.
-- Server-only column: members have no update grant on it.
alter table public.veteran_profiles add column if not exists founder_welcome_sent_at timestamptz;
