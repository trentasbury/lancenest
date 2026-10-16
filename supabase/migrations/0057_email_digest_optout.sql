-- Members can stop the weekly update email (CAN-SPAM opt-out). Account, security, and
-- application emails are transactional and unaffected.
alter table public.profiles add column if not exists email_digest boolean not null default true;
comment on column public.profiles.email_digest is 'Weekly update email opt-in; false after the member unsubscribes.';
grant update (email_digest) on public.profiles to authenticated;
