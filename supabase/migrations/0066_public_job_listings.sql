-- 0066: Public job pages (/open-jobs). Employers choose per job whether it is also listed publicly (company hidden).
-- Additive: one column. Public pages are read server-side with an explicit column list; no new public table access.
alter table public.jobs add column if not exists public_listing boolean not null default true;
comment on column public.jobs.public_listing is 'Also show this job on the public /open-jobs pages and in Google, with the company name hidden.';
grant insert (public_listing), update (public_listing) on public.jobs to authenticated;
