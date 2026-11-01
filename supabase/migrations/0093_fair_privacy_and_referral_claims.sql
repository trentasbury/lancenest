-- =====================================================================
-- 0093 (deep audit, November 1, 2026)
-- 1) A member who hid their profile from a company stays hidden from it at career fairs too (registering for a fair
--    used to show the member's name and headline to every booth, including companies they had hidden).
-- 2) referral_claims: a referral reward is paid once per verified person (or company domain), not once per account,
--    so deleting an account and re-joining on the same link doesn't pay the referrer again. Server-only.
-- =====================================================================

create or replace function private.profile_visible(target uuid, target_role text)
returns boolean
language sql stable security definer set search_path = 'public' as $$
  select case
    when target_role = 'client' then
      exists (select 1 from public.contracts k where k.client_id = target and k.freelancer_id = auth.uid())
      or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id
                  where fp.client_id = target and pr.freelancer_id = auth.uid())
      or exists (select 1 from public.freelance_projects fp where fp.client_id = target and fp.status = 'open')
    when target_role is distinct from 'veteran' then true
    when private.app_role() is distinct from 'employer' then true
    else private.employer_can_see(target)
      or exists (select 1 from public.contracts k where k.freelancer_id = target and k.client_id = auth.uid())
      or (not private.hidden_from_viewer(target) and (
            exists (select 1 from public.fair_registrations fr join public.fair_booths b on b.fair_id = fr.fair_id
                     where fr.profile_id = target and private.owns_company(b.company_id))
         or exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.is_public)
         or exists (select 1 from public.network_posts p where p.author_id = target and not p.hidden and p.visibility in ('public', 'network'))
         or exists (select 1 from public.post_comments c where c.author_id = target and not c.hidden)
         or exists (select 1 from public.service_listings s where s.profile_id = target and s.status = 'active')
         or exists (select 1 from public.mentor_profiles m where m.profile_id = target and m.available)
         or exists (select 1 from public.user_follows f where f.follower_id = target and f.following_id = auth.uid())
         or exists (select 1 from public.company_followers cf where cf.profile_id = target and private.owns_company(cf.company_id))))
  end;
$$;

create table public.referral_claims (
  identity_hash text primary key,
  referrer_id uuid,
  claimed_at timestamptz not null default now()
);
alter table public.referral_claims enable row level security;
comment on table public.referral_claims is 'One referral reward per verified person or company domain, kept when accounts are deleted. Server-only.';
