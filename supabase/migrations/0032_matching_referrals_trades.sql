-- =====================================================================
-- LinkedIn-style job matching on the whole profile (civilian experience,
-- headline, desired titles, skills) with military-job weight that fades
-- with time since service. Plus referrals, email throttling, and on-site
-- freelance work (trades).
-- =====================================================================
create or replace function private.clearance_rank(c text)
returns integer language sql immutable as $$
  select case coalesce(c, 'none') when 'public_trust' then 1 when 'confidential' then 2 when 'secret' then 3 when 'top_secret' then 4 when 'ts_sci' then 5 else 0 end;
$$;

create or replace function public.recommended_jobs(max_results integer default 20)
returns table (job_id uuid, score integer, reasons text[])
language plpgsql stable set search_path = public as $$
declare
  me uuid := auth.uid(); mos_w numeric := 0; last_end date; sep date; my_state text; my_clear text;
  exp_terms text[]; mos_terms text[];
  stop text[] := array['with','and','the','for','from','that','this','senior','junior','manager','specialist','lead','staff','officer','team','level','member','service','services','military','marine','army','navy','force','united','states','corps','assistant','associate'];
begin
  select v.separation_date, v.state, v.clearance_level into sep, my_state, my_clear from public.veteran_profiles v where v.profile_id = me;
  select max(coalesce(ms.end_date, current_date + 1)) into last_end from public.military_service ms where ms.profile_id = me;
  -- Military job weight: full while serving or separating, fading with years since service.
  if last_end is not null then
    mos_w := case when last_end > current_date or (sep is not null and sep >= current_date - 365) then 1.0
                  when last_end >= current_date - interval '3 years' then 0.8
                  when last_end >= current_date - interval '7 years' then 0.4
                  when last_end >= current_date - interval '15 years' then 0.15 else 0.05 end;
  end if;
  select array_agg(distinct w) into exp_terms from (
    select lower(regexp_split_to_table(coalesce(e.position, ''), '[^a-zA-Z]+')) as w from public.experience e where e.profile_id = me
    union all select lower(regexp_split_to_table(coalesce(p.headline, ''), '[^a-zA-Z]+')) from public.profiles p where p.id = me
    union all select lower(regexp_split_to_table(t, '[^a-zA-Z]+')) from public.veteran_profiles v, unnest(v.desired_titles) t where v.profile_id = me
  ) x where length(w) > 3 and not (w = any(stop));
  select array_agg(distinct w) into mos_terms from (
    select lower(regexp_split_to_table(c, '[^a-zA-Z]+')) as w
      from public.military_service ms join public.military_occupations o on o.id = ms.occupation_id, unnest(o.civilian_categories) c
     where ms.profile_id = me
  ) x where length(w) > 3 and not (w = any(stop));

  return query
  with sk as (select js.job_id as jid, count(*)::integer as n from public.job_skills js join public.profile_skills ps on ps.skill_id = js.skill_id and ps.profile_id = me group by js.job_id),
  scored as (
    select j.id as jid,
      coalesce(sk.n, 0) as skills_n,
      coalesce((select count(*) from unnest(exp_terms) t where lower(j.title) like '%' || t || '%'), 0)::integer * 6 as exp_pts,
      round(coalesce((select count(*) from unnest(mos_terms) t where lower(j.title) like '%' || t || '%'), 0) * 6 * mos_w)::integer as mos_pts,
      case when my_state is not null and (j.location ilike '%, ' || my_state || '%') then 2 else 0 end as loc_pts,
      case when coalesce(j.clearance_required, 'none') <> 'none' then 3 else 0 end as clr_pts
    from public.jobs j left join sk on sk.jid = j.id
    where j.status = 'open' and private.clearance_rank(my_clear) >= private.clearance_rank(j.clearance_required)
      and not exists (select 1 from public.applications a where a.job_id = j.id and a.profile_id = me)
  )
  select s.jid, (s.skills_n * 3 + s.exp_pts + s.mos_pts + s.loc_pts + s.clr_pts)::integer,
         array_remove(array[
           case when s.exp_pts > 0 then 'Matches your experience' end,
           case when s.skills_n > 0 then s.skills_n || ' of your skills' end,
           case when s.mos_pts > 0 then 'Fits your military background' end,
           case when s.loc_pts > 0 then 'In your state' end,
           case when s.clr_pts > 0 then 'You meet the clearance' end], null)
    from scored s
   where s.skills_n * 3 + s.exp_pts + s.mos_pts > 0
   order by 2 desc limit greatest(1, least(max_results, 50));
end $$;
revoke execute on function public.recommended_jobs(integer) from public, anon;
grant execute on function public.recommended_jobs(integer) to authenticated;

-- Referrals: who invited a member (set by the server at signup); free Pro months earned.
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id) on delete set null;
alter table public.veteran_profiles add column if not exists pro_granted_until timestamptz;
-- Message email throttling.
alter table public.conversation_participants add column if not exists last_emailed_at timestamptz;
-- Freelance: on-site work (HVAC, plumbing, electrical…) needs a location.
alter table public.freelance_projects add column if not exists work_location text check (char_length(work_location) <= 120);
grant insert (work_location), update (work_location) on public.freelance_projects to authenticated;
