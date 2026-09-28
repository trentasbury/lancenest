-- Jobs hiring in several locations (for the "Multiple locations" filter).
alter table public.jobs add column if not exists multi_location boolean not null default false;
grant insert (multi_location) on public.jobs to authenticated;
grant update (multi_location) on public.jobs to authenticated;

-- Verified work: jobs completed and paid through LanceNest Protected Payments (amounts never shown).
create or replace function public.verified_work(p uuid)
returns table (title text, completed_at timestamptz, client_name text, rating integer, review text)
language sql stable security definer set search_path = public as $$
  select k.title, k.updated_at, coalesce(co.name, cp.full_name), r.rating, r.body
    from public.contracts k
    left join public.freelance_projects fp on fp.id = k.project_id
    left join public.companies co on co.id = fp.company_id
    left join public.profiles cp on cp.id = k.client_id
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id
   where k.freelancer_id = p and k.status = 'completed' and private.is_verified_member()
   order by k.updated_at desc limit 20;
$$;
revoke execute on function public.verified_work(uuid) from public, anon;
grant execute on function public.verified_work(uuid) to authenticated;

create or replace function public.verified_work_summary(ids uuid[])
returns table (profile_id uuid, completed integer, avg_rating numeric)
language sql stable security definer set search_path = public as $$
  select k.freelancer_id, count(distinct k.id)::integer, round(avg(r.rating)::numeric, 1)
    from public.contracts k
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id
   where k.freelancer_id = any(ids) and k.status = 'completed' and private.is_verified_member()
   group by k.freelancer_id;
$$;
revoke execute on function public.verified_work_summary(uuid[]) from public, anon;
grant execute on function public.verified_work_summary(uuid[]) to authenticated;
