-- =====================================================================
-- 0094 (deep audit, November 1, 2026): team seats follow the plan.
-- After a downgrade or a lapsed payment, recruiters beyond the plan's seats (the most recently added first) lose
-- access to the company until the plan covers them again: Free 1 (owner only), Starter 2, Professional 3,
-- Federal 5, Enterprise 20 (the same numbers the seat limit uses when adding someone).
-- =====================================================================

create or replace function private.owns_company(target uuid)
returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.companies c where c.id = target and c.owner_id = auth.uid())
      or exists (
        select 1
          from (select m.profile_id, row_number() over (order by m.created_at, m.profile_id) as rn
                  from public.company_members m where m.company_id = target) s
          join public.companies c on c.id = target
         where s.profile_id = auth.uid()
           and s.rn < case c.plan when 'starter' then 2 when 'professional' then 3 when 'federal' then 5 when 'enterprise' then 20 else 1 end
      );
$$;
