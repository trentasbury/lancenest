-- Easy Apply: employers add up to 5 screening questions; applicants' answers are stored with the application.
alter table public.jobs add column if not exists screening_questions jsonb not null default '[]'::jsonb;
alter table public.jobs drop constraint if exists jobs_screening_questions_check;
alter table public.jobs add constraint jobs_screening_questions_check check (jsonb_typeof(screening_questions) = 'array' and jsonb_array_length(screening_questions) <= 5);
grant insert (screening_questions), update (screening_questions) on public.jobs to authenticated;
alter table public.applications add column if not exists answers jsonb not null default '[]'::jsonb;
alter table public.applications drop constraint if exists applications_answers_check;
alter table public.applications add constraint applications_answers_check check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 5 and length(answers::text) <= 8000);
grant insert (answers) on public.applications to authenticated;
