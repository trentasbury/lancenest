-- ClearanceJobs-style clearance details (all self-reported): status and polygraph for members; polygraph requirement for jobs.
alter table public.veteran_profiles add column if not exists clearance_status text check (clearance_status in ('active', 'current', 'expired'));
alter table public.veteran_profiles add column if not exists polygraph text not null default 'none' check (polygraph in ('none', 'ci', 'full_scope'));
grant update (clearance_status, polygraph) on public.veteran_profiles to authenticated;
alter table public.jobs add column if not exists polygraph_required text not null default 'none' check (polygraph_required in ('none', 'ci', 'full_scope'));
grant insert (polygraph_required), update (polygraph_required) on public.jobs to authenticated;
