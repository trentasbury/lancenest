-- =====================================================================
-- 0084: a strict wall between civilians and members.
--
-- 1) Only a VERIFIED company counts as a member-side employer. Before this, any account that signed up as an
--    "employer" passed is_verified_member(), so a civilian could pick "employer" at sign-up and read the
--    members-only network (posts, groups, mentors, freelancers, reviews, jobs, fairs) through the API.
-- 2) "Visible to verified employers" (veteran_profiles.is_public) now means exactly that. It used to open the
--    profile, service history, experience, education and skills to anyone, including signed-out visitors,
--    clients and unverified accounts (and to companies the member hid from).
-- 3) Jobs show to members only while their company is verified.
-- 4) Follow lists, company followers and reviews are no longer readable by civilian accounts.
-- 5) Completed-work history shows an individual client as "First L.", not their full name.
-- =====================================================================

-- 1) Members: verified service members and spouses, verified companies (owner or team seat), and admins.
create or replace function private.is_verified_member() returns boolean
language sql stable security definer set search_path = 'public' as $$
  select case
    when exists (select 1 from public.profiles p where p.id = auth.uid() and (p.banned or coalesce(p.suspended_until, '-infinity') > now())) then false
    else case private.app_role()
      when 'admin' then true
      when 'employer' then private.employer_verified()
      when 'veteran' then exists (select 1 from public.veteran_profiles v where v.profile_id = auth.uid() and v.verification_status = 'verified')
      else false end
  end;
$$;

-- 2) Who can read a member's profile details (veteran_profiles, military_service, experience, education,
--    certifications, profile_skills, and the anonymous profiles policy).
create or replace function private.can_view_veteran(target uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select auth.uid() = target
      or private.is_admin()
      or (not exists (select 1 from public.profiles p where p.id = target and p.banned) and (
            (private.app_role() = 'employer' and private.is_verified_member() and (
                 private.employer_can_see(target)
              or (not private.hidden_from_viewer(target)
                  and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public))))
         or (private.app_role() = 'veteran' and private.is_verified_member()
             and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))));
$$;

-- 3) Jobs: members see open jobs only from verified companies; the company's own team always sees its jobs.
alter policy jobs_read on public.jobs using (
  (status = 'open'
   and private.is_verified_member()
   and exists (select 1 from public.companies c where c.id = jobs.company_id and c.is_verified)
   and (coalesce(clearance_required, 'none') = 'none'
        or posted_at <= now() - interval '48 hours'
        or private.app_role() <> 'veteran'
        or exists (select 1 from public.veteran_profiles v where v.profile_id = (select auth.uid()) and v.plan in ('pro_plus', 'federal_pro'))))
  or private.owns_company(company_id)
  or private.is_admin()
);

-- 4) Follow graph: your own follows, or members.
alter policy follows_read on public.user_follows using (
  follower_id = (select auth.uid()) or following_id = (select auth.uid()) or private.is_verified_member()
);

-- Company followers: your own follows, the company's team, or admins.
alter policy company_followers_read on public.company_followers using (
  profile_id = (select auth.uid()) or private.owns_company(company_id) or private.is_admin()
);

-- Reviews: a client sees reviews of the freelancers they can see, and reviews they wrote or received.
alter policy reviews_read_clients on public.reviews using (
  private.is_active_client()
  and (reviewer_id = (select auth.uid()) or reviewee_id = (select auth.uid()) or private.client_can_see(reviewee_id))
);

-- 5) Completed work on a member's profile: a company's name, or an individual client as "First L.".
create or replace function public.verified_work(p uuid)
returns table (title text, completed_at timestamptz, client_name text, rating integer, review text)
language sql stable security definer set search_path = 'public' as $$
  select k.title, k.updated_at,
         coalesce(co.name,
           case when array_length(regexp_split_to_array(btrim(cp.full_name), '\s+'), 1) > 1
                then split_part(btrim(cp.full_name), ' ', 1) || ' ' || upper(left((regexp_split_to_array(btrim(cp.full_name), '\s+'))[array_length(regexp_split_to_array(btrim(cp.full_name), '\s+'), 1)], 1)) || '.'
                else nullif(btrim(cp.full_name), '') end),
         r.rating, r.body
    from public.contracts k
    left join public.freelance_projects fp on fp.id = k.project_id
    left join public.companies co on co.id = fp.company_id
    left join public.profiles cp on cp.id = k.client_id
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id
   where k.freelancer_id = p and k.status = 'completed' and private.is_verified_member()
   order by k.updated_at desc
   limit 20;
$$;
