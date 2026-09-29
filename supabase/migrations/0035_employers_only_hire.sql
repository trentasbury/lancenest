-- Only verified employers post freelance jobs and hire (members list services; employers hire them).
drop policy if exists projects_insert on public.freelance_projects;
create policy projects_insert on public.freelance_projects for insert to authenticated
  with check (client_id = auth.uid() and private.app_role() = 'employer' and private.owns_company(company_id)
              and exists (select 1 from public.companies c where c.id = company_id and c.is_verified));
