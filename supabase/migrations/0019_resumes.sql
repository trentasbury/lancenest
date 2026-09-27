-- =====================================================================
-- Résumés: the member manages one current résumé; only verified employers
-- already allowed to see that member can read it. Other members never can.
-- =====================================================================
drop policy if exists resumes_owner on public.resumes;
create policy resumes_owner on public.resumes for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.app_role() = 'veteran');
drop policy if exists resumes_employer_read on public.resumes;
create policy resumes_employer_read on public.resumes for select to authenticated
  using ((private.app_role() = 'employer' and private.is_verified_member()
          and exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.is_verified)
          and private.employer_can_see(profile_id))
         or private.is_admin());
create unique index if not exists resumes_one_per_profile on public.resumes (profile_id);
