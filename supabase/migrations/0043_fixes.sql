-- The founder's admin account can apply to jobs like any verified member.
drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own on public.applications for insert to authenticated
  with check (profile_id = auth.uid() and status = 'applied' and private.app_role() in ('veteran', 'admin') and private.is_verified_member()
              and (resume_id is null or exists (select 1 from public.resumes r where r.id = applications.resume_id and r.profile_id = auth.uid())));
-- Category rename: no vendor names.
update public.training_programs set category = 'Enterprise software' where category = 'ServiceNow & enterprise software';
update public.service_listings set category = 'Enterprise software (ITSM, ERP, CRM)' where category = 'ServiceNow & enterprise software';
update public.freelance_projects set category = 'Enterprise software (ITSM, ERP, CRM)' where category = 'ServiceNow & enterprise software';
update public.mentor_profiles set fields = array_replace(fields, 'ServiceNow & enterprise software', 'Enterprise software');
