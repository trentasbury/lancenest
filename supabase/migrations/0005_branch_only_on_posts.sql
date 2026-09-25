-- Show only the branch on posts and profiles ("U.S. Marine Corps"), never rank.
create or replace function private.refresh_service_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.profile_id, old.profile_id);
  b text;
begin
  select branch into b from public.military_service
  where profile_id = target order by start_date desc nulls last, created_at desc limit 1;
  update public.profiles set service_summary = case when b is null then null else 'U.S. ' || b end where id = target;
  return null;
end $$;

update public.profiles p set service_summary = 'U.S. ' || s.branch
from (select distinct on (profile_id) profile_id, branch from public.military_service
      order by profile_id, start_date desc nulls last, created_at desc) s
where s.profile_id = p.id;
