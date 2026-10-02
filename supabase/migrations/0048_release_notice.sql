-- Track the 3-day auto-release reminder so it is sent once per milestone.
alter table public.milestones add column if not exists release_notice_sent boolean not null default false;
