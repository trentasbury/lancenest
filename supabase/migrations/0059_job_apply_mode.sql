-- =====================================================================
-- LanceNest — how veterans apply to a job, chosen by the employer (like LinkedIn):
--   easy     Easy Apply on LanceNest only (résumé + screening answers)
--   external Apply on the company's own site only (careers page / ATS)
--   both     Veterans choose either
-- The company link itself is still validated by private.check_apply_url().
-- =====================================================================

alter table public.jobs add column if not exists apply_mode text not null default 'easy';

alter table public.jobs drop constraint if exists jobs_apply_mode_check;
alter table public.jobs add constraint jobs_apply_mode_check check (apply_mode in ('easy', 'external', 'both'));

-- Jobs that already had a company link offered both ways.
update public.jobs set apply_mode = 'both' where apply_url is not null and apply_mode = 'easy';

-- A company-site option needs a company link.
alter table public.jobs drop constraint if exists jobs_apply_mode_url_check;
alter table public.jobs add constraint jobs_apply_mode_url_check check (apply_mode = 'easy' or apply_url is not null);

grant insert (apply_mode) on public.jobs to authenticated;
grant update (apply_mode) on public.jobs to authenticated;
