-- 0080: Security review, October 31. Closes small bypasses found after client accounts went live.
-- Policies are changed with ALTER POLICY (nothing dropped); new triggers use CREATE OR REPLACE.

-- 1) Only member accounts send verification documents, and an already-verified member only when they're a spouse
--    renewing (keeps employers and clients out of the review queue and stops queue spam).
alter policy verification_insert_own on public.verification_requests with check (
  profile_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and reviewed_at is null
  and private.app_role() = 'veteran'
  and not exists (select 1 from public.veteran_profiles v where v.profile_id = (select auth.uid())
                  and v.verification_status = 'verified' and v.member_type is distinct from 'spouse')
  and (document_path is null or split_part(document_path, '/', 1) = (select auth.uid())::text)
  and (id_document_path is null or split_part(id_document_path, '/', 1) = (select auth.uid())::text));

-- 2) Military career, jobs, schools, certifications and skills belong to member profiles only, so an employer or
--    client account can't give itself a service record ("U.S. Marine Corps · 0311") on its profile.
alter policy military_service_write on public.military_service using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.app_role() in ('veteran', 'admin'));
alter policy experience_write on public.experience using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.app_role() in ('veteran', 'admin'));
alter policy education_write on public.education using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.app_role() in ('veteran', 'admin'));
alter policy certifications_write on public.certifications using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.app_role() in ('veteran', 'admin'));
alter policy profile_skills_write on public.profile_skills using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.app_role() in ('veteran', 'admin'));

-- The shared skills list: only members add to it, 60 characters at most (checked for new rows only).
alter policy skills_insert on public.skills with check (private.app_role() in ('veteran', 'admin'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'skills_name_length' and conrelid = 'public.skills'::regclass) then
    alter table public.skills add constraint skills_name_length check (char_length(name) between 1 and 60) not valid;
  end if;
end $$;

-- 3) "Who viewed your profile" only counts real viewers: active members and employers, or a client looking at a
--    freelancer they can hire. Nobody can fill someone's list with fake visits.
alter policy profile_views_insert on public.profile_views with check (
  viewer_id = (select auth.uid()) and (private.can_engage() or (private.is_active_client() and private.client_can_see(profile_id))));

-- 4) A trade service paused because its license lapsed can't be switched back on without a valid license.
create or replace function private.block_licensed_trades() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.category in ('HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors')
     and not private.is_admin()
     and (tg_op = 'INSERT' or new.status = 'active') then
    if tg_table_name = 'service_listings' and not private.has_trade_license(new.profile_id, new.category) then
      raise exception 'licensed_trade' using errcode = 'P0018', hint = 'Add your license for this trade and get it verified first.';
    end if;
  end if;
  return new;
end $$;
create or replace trigger licensed_trades_services before insert or update of category, status on public.service_listings
  for each row execute function private.block_licensed_trades();

-- 5) Conduct rules also cover profile sections, recommendations, training listings, fair booths, skills,
--    milestones and invoices. Common look-alike spellings (p0rn, b00bs) are caught too.
create or replace function private.explicit_signal(t text) returns boolean
language sql immutable set search_path = 'public' as $$
  with v(s) as (select lower(t) union all select translate(lower(t), '0134578@$!|', 'oieastbasil'))
  select t is not null and exists (select 1 from v where s ~ (
    '\m(porn\w*|nudes|nude (pics?|photos?)|naked (pics?|photos?)|onlyfans|only fans|fansly|sexting|sexts?|blow ?jobs?|hand ?jobs?|cumshots?|gang ?bangs?|milfs?|hentai'
    || '|dick ?pics?|pussy|titties|tits|boobs|orgasms?|horny|erotica|camgirls?|cam girls?|nsfw|escort services?|sugar (daddy|baby|babies)'
    || '|nigg(er|ers|a|as|az)|faggots?|kikes?|wetbacks?|trann(y|ies))\M'));
$$;
revoke all on function private.explicit_signal(text) from public, anon, authenticated;

create or replace trigger conduct_military_service before insert or update of duty_title, unit, description on public.military_service
  for each row execute function private.block_explicit('duty_title', 'unit', 'description');
create or replace trigger conduct_experience before insert or update of company, position, description on public.experience
  for each row execute function private.block_explicit('company', 'position', 'description');
create or replace trigger conduct_education before insert or update of school, degree, field on public.education
  for each row execute function private.block_explicit('school', 'degree', 'field');
create or replace trigger conduct_certifications before insert or update of name, issuer on public.certifications
  for each row execute function private.block_explicit('name', 'issuer');
create or replace trigger conduct_recommendations before insert or update of body, relationship on public.recommendations
  for each row execute function private.block_explicit('body', 'relationship');
create or replace trigger conduct_training before insert or update of title, description on public.training_programs
  for each row execute function private.block_explicit('title', 'description');
create or replace trigger conduct_fair_booths before insert or update of pitch on public.fair_booths
  for each row execute function private.block_explicit('pitch');
create or replace trigger conduct_skills before insert or update of name on public.skills
  for each row execute function private.block_explicit('name');
create or replace trigger conduct_milestones before insert or update of title, submission_note, change_request, dispute_reason on public.milestones
  for each row execute function private.block_explicit('title', 'submission_note', 'change_request', 'dispute_reason');
create or replace trigger conduct_invoices before insert or update of description on public.contract_invoices
  for each row execute function private.block_explicit('description');

-- 6) Conversation membership is set by the server only; members can mark a conversation read, nothing else.
revoke insert, update on public.conversation_participants from authenticated;
grant update (last_read_at) on public.conversation_participants to authenticated;
