-- The founder's admin account keeps a member profile: allow résumé management for admin too.
drop policy if exists resumes_owner on public.resumes;
create policy resumes_owner on public.resumes for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and private.app_role() in ('veteran', 'admin'));
