-- Founding Employers: the first 50 companies to subscribe to Professional keep $149/mo for life.
alter table public.subscriptions add column if not exists founding boolean not null default false;
