-- =====================================================================
-- LanceNest — DEMO network activity (fictional people; display-only).
-- These accounts have no password and cannot log in.
-- REMOVE ALL DEMO DATA before launch with ONE command (cascades to
-- profiles, posts, reactions, comments, follows):
--   delete from auth.users where raw_app_meta_data ->> 'demo' = 'true';
-- =====================================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email, '', now(),
       '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
       jsonb_build_object('full_name', v.name, 'role', 'veteran'), now() - interval '40 days', now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001', 'Jordan Hale',   'jordan.hale@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000002', 'Avery Collins', 'avery.collins@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000003', 'Riley Santos',  'riley.santos@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000004', 'Quinn Mercer',  'quinn.mercer@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000005', 'Taylor Brooks', 'taylor.brooks@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000006', 'Parker Lane',   'parker.lane@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000007', 'Emerson Cole',  'emerson.cole@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000008', 'Hayden Price',  'hayden.price@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000009', 'Rowan Ellis',   'rowan.ellis@demo.lancenest.invalid'),
  ('d0000000-0000-4000-8000-000000000010', 'Sawyer Grant',  'sawyer.grant@demo.lancenest.invalid')
) as v(id, name, email)
on conflict (id) do nothing;

-- Profiles (created by the signup trigger) — fill in details.
update public.profiles p set headline = v.headline, location = v.city || ', ' || v.st, verified = v.verified, onboarding_completed = true
from (values
  ('d0000000-0000-4000-8000-000000000001', 'Operations Manager · Infantry veteran', 'Fayetteville', 'NC', true),
  ('d0000000-0000-4000-8000-000000000002', 'Supply chain & logistics · PMP', 'Norfolk', 'VA', true),
  ('d0000000-0000-4000-8000-000000000003', 'Corporate security leader', 'San Antonio', 'TX', true),
  ('d0000000-0000-4000-8000-000000000004', 'Director of Operations', 'Jacksonville', 'NC', true),
  ('d0000000-0000-4000-8000-000000000005', 'IT systems & cybersecurity', 'Killeen', 'TX', false),
  ('d0000000-0000-4000-8000-000000000006', 'Founder, Tidewater Medical Staffing', 'San Diego', 'CA', true),
  ('d0000000-0000-4000-8000-000000000007', 'Marine operations & safety', 'Portsmouth', 'VA', true),
  ('d0000000-0000-4000-8000-000000000008', 'Data Analyst · Intelligence veteran', 'Colorado Springs', 'CO', false),
  ('d0000000-0000-4000-8000-000000000009', 'Transitioning · SkillBridge intern', 'Dover', 'DE', false),
  ('d0000000-0000-4000-8000-000000000010', 'Fleet operations', 'Orlando', 'FL', true)
) as v(id, headline, city, st, verified)
where p.id = v.id::uuid;

update public.veteran_profiles vp set about = 'Demo profile — a fictional member shown while LanceNest launches.',
       city = split_part(p.location, ', ', 1), state = split_part(p.location, ', ', 2), is_public = true,
       verification_status = case when p.verified then 'verified' else 'not_verified' end
from public.profiles p where p.id = vp.profile_id and p.id::text like 'd0000000-0000-4000-8000-%';

insert into public.military_service (profile_id, branch, rank, occupation_code, occupation_id, start_date, end_date, deployments)
select v.id::uuid, v.branch, v.rank, v.code,
       (select o.id from public.military_occupations o where o.code = v.code and o.branch = v.branch),
       v.s::date, v.e::date, v.dep
from (values
  ('d0000000-0000-4000-8000-000000000001', 'Army', 'SSG', '11B', '2014-06-01', '2022-06-01', 2),
  ('d0000000-0000-4000-8000-000000000002', 'Navy', 'LS1', 'LS', '2015-01-01', '2021-01-01', 3),
  ('d0000000-0000-4000-8000-000000000003', 'Air Force', 'TSgt', '3P0X1', '2005-01-01', '2025-01-01', 2),
  ('d0000000-0000-4000-8000-000000000004', 'Marine Corps', 'Sgt', '0311', '2012-01-01', '2017-01-01', 1),
  ('d0000000-0000-4000-8000-000000000005', 'Army', 'SGT', '25B', '2016-01-01', '2022-01-01', 1),
  ('d0000000-0000-4000-8000-000000000006', 'Navy', 'HM2', 'HM', '2013-01-01', '2020-01-01', 2),
  ('d0000000-0000-4000-8000-000000000007', 'Coast Guard', 'BM1', 'BM', '2010-01-01', '2022-01-01', 0),
  ('d0000000-0000-4000-8000-000000000008', 'Army', 'SSG', '35F', '2012-01-01', '2021-01-01', 3),
  ('d0000000-0000-4000-8000-000000000009', 'Air Force', 'SSgt', '2T2X1', '2019-01-01', null, 1),
  ('d0000000-0000-4000-8000-000000000010', 'Marine Corps', 'Cpl', '3531', '2018-01-01', '2022-01-01', 1)
) as v(id, branch, rank, code, s, e, dep)
where not exists (select 1 from public.military_service ms where ms.profile_id = v.id::uuid);

-- Everyone follows the next three people (so the "Following" feed has content).
insert into public.user_follows (follower_id, following_id)
select a.id, b.id
from (select id, row_number() over (order by id) - 1 as n from public.profiles where id::text like 'd0000000-0000-4000-8000-%') a
join (select id, row_number() over (order by id) - 1 as n from public.profiles where id::text like 'd0000000-0000-4000-8000-%') b
  on b.n in ((a.n + 1) % 10, (a.n + 2) % 10, (a.n + 3) % 10)
on conflict do nothing;

-- Milestone posts and updates, spread over the past two weeks.
insert into public.network_posts (id, author_id, post_type, milestone, headline, body, title, organization, visibility, created_at)
select v.id::uuid, v.author::uuid, v.type, v.milestone, v.headline, v.body, v.title, v.org, v.vis, now() - (v.hours || ' hours')::interval
from (values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'career', 'new_job', 'Started a new position as Operations Manager at Anchor & Oak Logistics', 'Eight years leading Soldiers translated directly into leading a 40-person warehouse team. Grateful to everyone who helped me make the jump.', 'Operations Manager', 'Anchor & Oak Logistics', 'network', 3),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'certification', 'certification', 'Earned the PMP certification from PMI', 'Four months of nights and weekends. The Navy taught me the discipline — PMI gave me the vocabulary for it.', 'PMP', 'PMI', 'public', 9),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'military', 'military_retirement', 'Retired from the U.S. Air Force after 20 years of service', 'Twenty years, six bases, one incredible family. Next chapter: corporate security leadership in San Antonio.', 'TSgt', 'U.S. Air Force', 'public', 20),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'career', 'promotion', 'Was promoted to Director of Operations at Brass Compass Consulting', '', 'Director of Operations', 'Brass Compass Consulting', 'network', 30),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000005', 'education', 'graduation', 'Graduated with a B.S. in Cybersecurity from Old Dominion University', 'Used every bit of my GI Bill. Worth it.', 'B.S. in Cybersecurity', 'Old Dominion University', 'network', 44),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'business', 'new_business', 'Launched Tidewater Medical Staffing', 'Veteran-owned, and we are hiring corpsmen and medics first. If you served in a medical rating or MOS, my inbox is open.', null, 'Tidewater Medical Staffing', 'public', 60),
  ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000007', 'accomplishment', 'award', 'Received the Coast Guard Achievement Medal', 'Shared with the best boat crew I have ever served with.', 'Coast Guard Achievement Medal', null, 'network', 80),
  ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000008', 'career', 'career_transition', 'Transitioned into a new role as Data Analyst at Summit Line Cyber', 'Intelligence analysis → data analysis. Same instincts, new tools.', 'Data Analyst', 'Summit Line Cyber', 'network', 110),
  ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000009', 'general', null, null, 'Just finished my first week of a SkillBridge internship. If you are within 180 days of separation, ask your command about it — it has changed my whole transition.', null, null, 'network', 140),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000010', 'certification', 'certification', 'Earned the CDL Class A certification', 'Motor T in the Marines, now doing it with a civilian license. Orlando friends — who is hiring drivers?', 'CDL Class A', null, 'network', 170),
  ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'general', null, null, 'Resume tip that finally worked for me: stop writing "squad leader" and start writing "led and trained a 9-person team responsible for $2M in equipment." Same job, different language.', null, null, 'public', 200),
  ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000004', 'accomplishment', 'volunteer', 'Recognized for volunteer service with Harbor Rescue Volunteers', 'Weekend disaster response keeps me close to the mission.', null, 'Harbor Rescue Volunteers', 'network', 260)
) as v(id, author, type, milestone, headline, body, title, org, vis, hours)
on conflict (id) do nothing;

-- Reactions: about two-thirds of the other demo members react to each post.
insert into public.post_reactions (post_id, profile_id, reaction)
select p.id, u.id, (array['congratulations','proud','support','well_done','inspiring','thank_you'])[((p.n + u.n) % 6) + 1]
from (select id, author_id, row_number() over (order by id) as n from public.network_posts where id::text like 'e0000000-0000-4000-8000-%') p
join (select id, row_number() over (order by id) as n from public.profiles where id::text like 'd0000000-0000-4000-8000-%') u
  on u.id <> p.author_id and (p.n + u.n) % 3 <> 0
on conflict do nothing;

-- Comments and a few replies.
insert into public.post_comments (id, post_id, author_id, parent_id, body, created_at)
select v.id::uuid, v.post::uuid, v.author::uuid, v.parent::uuid, v.body, now() - (v.hours || ' hours')::interval
from (values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', null, 'Congratulations, brother. Well deserved.', 2),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Appreciate you — your advice on the interview made the difference.', 1),
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000008', null, 'Huge. I am starting my PMP studies next month — any resources you would recommend?', 8),
  ('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'Happy to share my study plan. Sending you a message.', 7),
  ('f0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000007', null, 'Twenty years. Thank you for your service, and congratulations on the next chapter.', 18),
  ('f0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000010', null, 'Legend. Enjoy it.', 16),
  ('f0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003', null, 'GI Bill well spent. Congrats!', 40),
  ('f0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', null, 'This is exactly what the community needs. Rooting for you.', 55),
  ('f0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000005', null, 'Wish I had known about SkillBridge before I got out. Great advice.', 130),
  ('f0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000009', null, 'Saving this. Rewriting my resume tonight.', 190)
) as v(id, post, author, parent, body, hours)
on conflict (id) do nothing;

-- One share, showing the original-post embed.
insert into public.network_posts (id, author_id, post_type, body, visibility, is_share, shared_post_id, created_at)
values ('e0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000007', 'general',
        'Every transitioning service member should read this.', 'network', true, 'e0000000-0000-4000-8000-000000000011', now() - interval '150 hours')
on conflict (id) do nothing;

select (select count(*) from public.profiles where id::text like 'd0000000-0000-4000-8000-%') as demo_members,
       (select count(*) from public.network_posts where author_id::text like 'd0000000-0000-4000-8000-%') as posts,
       (select count(*) from public.post_reactions where profile_id::text like 'd0000000-0000-4000-8000-%') as reactions,
       (select count(*) from public.post_comments where author_id::text like 'd0000000-0000-4000-8000-%') as comments,
       (select count(*) from public.user_follows where follower_id::text like 'd0000000-0000-4000-8000-%') as follows;
