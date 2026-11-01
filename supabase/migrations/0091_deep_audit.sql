-- =====================================================================
-- 0091 (deep audit, November 1, 2026). Security fixes; no pricing changes.
--  1) Résumé records must point at a file in the member's own folder (no pointing at someone else's résumé).
--  2) Unverified company pages are private to their owner, team and LanceNest staff.
--  3) Proposals always start as "submitted"; members can't backdate them to dodge the free monthly limit.
--  4) Applications: server-set dates and employer-only fields; only open jobs; the employer's chosen apply method;
--     a rejected applicant can't flip themselves back to "applied".
--  5) Automatic hiding/pausing from reports only counts reports by verified service members and spouses.
--  6) "Lance Nest", "Lance-Nest" etc. are reserved like "LanceNest" (checked only when the name changes).
--  7) Freelancers can't put phone numbers, emails or contact handles in their name, headline, summary, location or
--     skills (clients see these), the same rule as listings and proposals.
--  8) Profile photos and company logos can only be set by LanceNest's upload (no outside image links).
--  9) Dates are set by the server: no backdating (rate limits, message history, reviews) or future dates that pin a
--     listing to the top of a page. Message attachments (unused) can't be set.
-- 10) A comment reply must belong to the same post.
-- 11) identity_claims: one-time perks follow the verified person, not the account (deleting and re-joining doesn't
--     unlock Founding Member, Transition Pro or a partner card again). Server-only.
-- 12) Contact filter: no false alarms on service years ("2010-2018 | 11B"), ".NET developer" or Socket.IO.
-- =====================================================================

-- 1) Résumé file paths
create or replace function private.resume_path_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_admin()
     and (split_part(new.storage_path, '/', 1) <> new.profile_id::text or new.storage_path like '%..%') then
    raise exception 'invalid_path' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger resumes_path_check
  before insert or update of storage_path, profile_id on public.resumes
  for each row execute function private.resume_path_check();

-- 2) Company pages
alter policy companies_read on public.companies using (
  is_verified or owner_id = (select auth.uid()) or private.owns_company(id) or private.is_admin()
);

-- 3) Proposals
create or replace function private.proposals_server_fields() returns trigger
language plpgsql set search_path = 'public' as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if tg_op = 'INSERT' then
      new.viewed_at := null; new.credit_refunded_at := null;
      new.status := 'submitted'; new.created_at := now(); new.updated_at := now();
    else
      new.viewed_at := old.viewed_at; new.credit_refunded_at := old.credit_refunded_at; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- 4) Applications
create or replace function private.applications_server_fields() returns trigger
language plpgsql set search_path = 'public' as $$
declare j record;
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if tg_op = 'INSERT' then
      new.command_approval := null;
      new.applied_at := now(); new.updated_at := now();
      new.notes := null; new.interview_at := null;
      select status, apply_mode into j from public.jobs where id = new.job_id;
      if j.status is distinct from 'open' then
        raise exception 'job_closed' using errcode = 'P0025', hint = 'This job isn’t taking applications.';
      end if;
      if (new.source = 'lancenest' and j.apply_mode = 'external') or (new.source = 'external' and j.apply_mode = 'easy') then
        raise exception 'apply_method' using errcode = 'P0025', hint = 'Apply the way this employer asks.';
      end if;
    else
      if new.command_approval is distinct from old.command_approval then new.command_approval := old.command_approval; end if;
      new.applied_at := old.applied_at;
      if auth.uid() = old.profile_id and not private.owns_job(old.job_id) then
        new.notes := old.notes; new.interview_at := old.interview_at;
        if new.status is distinct from old.status
           and (old.status = 'rejected' or (new.status = 'applied' and old.status <> 'withdrawn')) then
          raise exception 'not_allowed' using errcode = '42501';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

-- 5) Reports: only verified service members and spouses count toward automatic action
create or replace function private.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare reporters integer; co uuid; co_reporters integer;
begin
  if not exists (select 1 from public.profiles p join public.veteran_profiles v on v.profile_id = p.id
                  where p.id = new.reporter_id and p.role = 'veteran' and not p.banned and v.verification_status = 'verified') then
    return null;  -- the report is kept for the team; it just doesn't trigger anything automatically
  end if;
  if new.target_type in ('post', 'comment') then
    select count(distinct r.reporter_id) into reporters from public.reports r
      join public.profiles p on p.id = r.reporter_id and p.role = 'veteran' and not p.banned
      join public.veteran_profiles v on v.profile_id = r.reporter_id and v.verification_status = 'verified'
     where r.target_type = new.target_type and r.target_id = new.target_id and r.status in ('open', 'reviewing');
    if reporters >= 3 then
      if new.target_type = 'post' then update public.network_posts set hidden = true where id = new.target_id;
      else update public.post_comments set hidden = true where id = new.target_id; end if;
    end if;
  elsif new.target_type = 'job' then
    select company_id into co from public.jobs where id = new.target_id;
    if co is null then return null; end if;
    select count(distinct r.reporter_id) into reporters from public.reports r
      join public.profiles p on p.id = r.reporter_id and p.role = 'veteran' and not p.banned
      join public.veteran_profiles v on v.profile_id = r.reporter_id and v.verification_status = 'verified'
     where r.target_type = 'job' and r.target_id = new.target_id and r.status in ('open', 'reviewing');
    if reporters >= 3 then
      update public.jobs set status = 'paused' where id = new.target_id and status = 'open';
    end if;
    select count(distinct r.reporter_id) into co_reporters from public.reports r
      join public.jobs j on j.id = r.target_id
      join public.profiles p on p.id = r.reporter_id and p.role = 'veteran' and not p.banned
      join public.veteran_profiles v on v.profile_id = r.reporter_id and v.verification_status = 'verified'
     where r.target_type = 'job' and j.company_id = co and r.status in ('open', 'reviewing');
    if co_reporters >= 5 then
      update public.companies set is_verified = false, verification_status = 'pending',
             verification_note = 'Suspended automatically after multiple member reports — pending review.'
       where id = co and is_verified;
      update public.jobs set status = 'paused' where company_id = co and status = 'open';
    end if;
    if reporters = 3 or co_reporters = 5 then
      insert into public.notifications (profile_id, type, title, link)
      select id, 'report_alert', case when co_reporters = 5 then 'A company was suspended automatically after 5 member reports.' else 'A job was paused automatically after 3 member reports.' end, '/admin/reports'
        from public.profiles where role = 'admin';
    end if;
  end if;
  return null;
end $$;

-- 6) Reserved names (checked only when a name changes, so existing accounts can still save)
create or replace function private.block_reserved_names() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_table_name = 'profiles' then
    if new.role = 'admin' then return new; end if;
    if (tg_op = 'INSERT' or new.full_name is distinct from old.full_name)
       and (new.full_name ~* '\mlancenest|\mlance[\s._-]+nest\M' or new.full_name ~* '\m(admin|administrator|moderator)\M'
            or new.full_name ~* '\m(support|trust\s*(&|and)?\s*safety|verification)\s+team\M') then
      raise exception 'reserved_name' using errcode = 'P0019', hint = 'Names can’t include LanceNest, admin, or moderator.';
    end if;
    if (tg_op = 'INSERT' or new.username is distinct from old.username)
       and (new.username ~* '\mlancenest|\mlance[\s._-]+nest\M' or new.username ~* '\m(admin|administrator|moderator)\M') then
      raise exception 'reserved_name' using errcode = 'P0019', hint = 'Names can’t include LanceNest, admin, or moderator.';
    end if;
  elsif (tg_op = 'INSERT' or new.name is distinct from old.name)
        and new.name ~* '\mlancenest|\mlance[\s._-]+nest\M' and not private.is_admin() then
    raise exception 'reserved_name' using errcode = 'P0019', hint = 'Company names can’t include LanceNest.';
  end if;
  return new;
end $$;

-- 7) Direct contact details in what clients see (links like "Socket.io" are fine here)
create or replace function private.block_direct_contact() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare col text; sig text;
begin
  if private.is_admin() then return new; end if;
  if tg_table_name = 'profiles' and new.role is distinct from 'veteran' then return new; end if;
  foreach col in array tg_argv loop
    if tg_op = 'UPDATE' and (to_jsonb(new) ->> col) is not distinct from (to_jsonb(old) ->> col) then continue; end if;
    sig := private.contact_signal(to_jsonb(new) ->> col);
    if sig is not null and sig <> 'link' then
      raise exception 'contact_info' using errcode = 'P0017', hint = sig;
    end if;
  end loop;
  return new;
end $$;

create trigger contact_guard_profiles
  before insert or update of full_name, headline, service_summary, location on public.profiles
  for each row execute function private.block_direct_contact('full_name', 'headline', 'service_summary', 'location');

create trigger contact_guard_skills
  before insert or update of name on public.skills
  for each row execute function private.block_direct_contact('name');

-- 8) Photos and logos only through LanceNest's upload (which runs on the server)
create or replace function private.lock_uploaded_images() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  if tg_table_name = 'profiles' then
    new.avatar_url := old.avatar_url;
  elsif tg_op = 'INSERT' then
    new.logo_url := null;
  else
    new.logo_url := old.logo_url;
  end if;
  return new;
end $$;

create trigger profiles_lock_avatar
  before update of avatar_url on public.profiles
  for each row execute function private.lock_uploaded_images();

create trigger companies_lock_logo
  before insert or update of logo_url on public.companies
  for each row execute function private.lock_uploaded_images();

-- 9) Server-set dates
create or replace function private.stamp_times() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.created_at := now(); else new.created_at := old.created_at; end if;
  if 'updated' = any(tg_argv) then new.updated_at := now(); end if;
  if 'no_attachment' = any(tg_argv) then new.attachment_path := null; end if;
  return new;
end $$;

create trigger aa_stamp_messages        before insert on public.messages            for each row execute function private.stamp_times('no_attachment');
create trigger aa_stamp_comments        before insert on public.post_comments       for each row execute function private.stamp_times('updated');
create trigger aa_stamp_reports         before insert on public.reports             for each row execute function private.stamp_times();
create trigger aa_stamp_follows         before insert on public.user_follows        for each row execute function private.stamp_times();
create trigger aa_stamp_verifications   before insert on public.verification_requests for each row execute function private.stamp_times();
create trigger aa_stamp_company_follows before insert on public.company_followers   for each row execute function private.stamp_times();
create trigger aa_stamp_fair_regs       before insert on public.fair_registrations  for each row execute function private.stamp_times();
create trigger aa_stamp_saved_jobs      before insert on public.saved_jobs          for each row execute function private.stamp_times();
create trigger aa_stamp_recommendations before insert on public.recommendations     for each row execute function private.stamp_times();
create trigger aa_stamp_reviews         before insert on public.reviews             for each row execute function private.stamp_times();
create trigger aa_stamp_job_alerts      before insert on public.job_alerts          for each row execute function private.stamp_times();
create trigger aa_stamp_reactions       before insert on public.post_reactions      for each row execute function private.stamp_times('updated');
create trigger aa_stamp_waitlist        before insert or update on public.plan_waitlist     for each row execute function private.stamp_times();
create trigger aa_stamp_group_members   before insert or update on public.group_members     for each row execute function private.stamp_times();
create trigger aa_stamp_talent_pool     before insert or update on public.talent_pool_items for each row execute function private.stamp_times();
create trigger aa_stamp_saved_searches  before insert on public.saved_searches              for each row execute function private.stamp_times();
create trigger aa_stamp_projects        before insert on public.freelance_projects          for each row execute function private.stamp_times('updated');
create trigger aa_stamp_services        before insert or update on public.service_listings  for each row execute function private.stamp_times('updated');
create trigger aa_stamp_mentors         before insert or update on public.mentor_profiles   for each row execute function private.stamp_times('updated');
create trigger aa_stamp_training        before insert or update on public.training_programs for each row execute function private.stamp_times('updated');
create trigger aa_stamp_portfolio       before insert or update on public.portfolio_items   for each row execute function private.stamp_times();
create trigger aa_stamp_certifications  before insert or update on public.certifications    for each row execute function private.stamp_times();
create trigger aa_stamp_education       before insert or update on public.education         for each row execute function private.stamp_times('updated');
create trigger aa_stamp_experience      before insert or update on public.experience        for each row execute function private.stamp_times('updated');
create trigger aa_stamp_service_record  before insert or update on public.military_service  for each row execute function private.stamp_times('updated');

create or replace function private.stamp_views() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  new.viewed_on := current_date;
  if tg_table_name = 'profile_views' then new.viewed_at := now(); end if;
  return new;
end $$;

create trigger aa_stamp_job_views     before insert on public.job_views     for each row execute function private.stamp_views();
create trigger aa_stamp_profile_views before insert on public.profile_views for each row execute function private.stamp_views();

-- 10) Replies stay on their own post
create or replace function private.comment_parent_check() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.parent_id is not null
     and not exists (select 1 from public.post_comments c where c.id = new.parent_id and c.post_id = new.post_id) then
    raise exception 'invalid_parent' using errcode = '23503';
  end if;
  return new;
end $$;

create trigger post_comments_parent_check
  before insert on public.post_comments
  for each row execute function private.comment_parent_check();

-- 11) One-time perks, per verified person (server-only: RLS on, no policies)
create table public.identity_claims (
  identity_hash text not null,
  perk text not null check (perk in ('founding_member', 'transition_pro', 'partner_code', 'founding_employer')),
  profile_id uuid,
  claimed_at timestamptz not null default now(),
  primary key (identity_hash, perk)
);
alter table public.identity_claims enable row level security;
comment on table public.identity_claims is 'One-time perks keyed by the verified identity fingerprint (or a verified company domain), kept when an account is deleted. Server-only.';

-- 12) Contact filter false alarms
create or replace function private.contact_signal(txt text) returns text
language plpgsql immutable set search_path = '' as $$
declare t text; digits text; nospace text;
begin
  if txt is null or btrim(txt) = '' then return null; end if;
  t := lower(txt);
  t := regexp_replace(t, '(https?://)?(www\.)?lancenest\.com[^\s]*', ' ', 'g');
  t := regexp_replace(t, '\m(asp|vb|ado)\.net\M', ' ', 'g');
  -- Tech names that look like contact details: ".NET" spelled out, Socket.IO.
  t := regexp_replace(t, '\mdot\s*net\s+(developer|developers|engineer|engineers|programmer|framework|core|stack|apps?|applications?|dev|experience|mvc|web|backend|full)\M', ' ', 'g');
  t := regexp_replace(t, '\msocket\.io\M', ' ', 'g');

  -- Email
  if t ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return 'email'; end if;
  if t ~ '\m(gmail|yahoo|hotmail|outlook|icloud|proton(mail)?|aol)\M\s*(\.|dot\M|com\M)'
     or t ~ '\mat\s*[\]\)]?\s*(gmail|yahoo|hotmail|outlook|icloud|proton(mail)?|aol)\M'
     or t ~ '\mdot\s*(com|net|org)\M' or t ~ '[\(\[]\s*at\s*[\)\]]' then return 'email'; end if;
  nospace := regexp_replace(t, '[[:space:]]+', '', 'g');
  if nospace ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return 'email'; end if;

  -- Phone: formatted, then written as words or with spaced digits
  if t ~ '(^|[^0-9$,.])(\+?1[\s.-]?)?\(?[2-9][0-9]{2}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}([^0-9]|$)' then return 'phone'; end if;
  -- Years ("2010-2018 | 11B") are never part of a phone number written out digit by digit.
  digits := regexp_replace(t, '\m(19|20)[0-9]{2}\M', ' x ', 'g');
  digits := regexp_replace(digits, '\m(zero|oh)\M', '0', 'g');
  digits := regexp_replace(digits, '\mone\M', '1', 'g');
  digits := regexp_replace(digits, '\mtwo\M', '2', 'g');
  digits := regexp_replace(digits, '\mthree\M', '3', 'g');
  digits := regexp_replace(digits, '\mfour\M', '4', 'g');
  digits := regexp_replace(digits, '\mfive\M', '5', 'g');
  digits := regexp_replace(digits, '\msix\M', '6', 'g');
  digits := regexp_replace(digits, '\mseven\M', '7', 'g');
  digits := regexp_replace(digits, '\meight\M', '8', 'g');
  digits := regexp_replace(digits, '\mnine\M', '9', 'g');
  digits := regexp_replace(digits, '([0-9])[[:space:].\-_/|()+]+(?=[0-9])', '\1', 'g');
  if digits ~ '[0-9]{10,}' then return 'phone'; end if;

  -- Links
  if t ~ '(https?://|www\.)' or t ~ '\m[a-z0-9-]+\.(com|net|org|io|co|us|me|biz|info|app|dev|ly|link|page|site)\M' then return 'link'; end if;

  -- Paying outside LanceNest
  if t ~ '\m(venmo|zelle|cash\s?app|paypal|apple\s?pay|google\s?pay|chime|western\s+union|money\s?gram|wire\s+transfer|bitcoin|crypto)\M'
     or t ~ '(^|\s)\$[a-z][a-z0-9_]{2,}'
     or t ~ '\mpay\s+(me|you|us)\s+(directly|direct|in\s+person|outside)\M' or t ~ '\mdirect(ly)?\s+(pay|payment)\M' then return 'payment_app'; end if;

  -- Contact handles and apps
  if t ~ '\m(text|call|email|e-mail|message|dm|ping|reach)\s+me\s+(at|on|directly)\M'
     or t ~ '\mmy\s+(cell|phone|number|email|e-mail)\M'
     or t ~ '\mmy\s+(ig|insta|instagram|snap|snapchat|whatsapp|telegram|facebook|fb|tiktok)\s*(is\M|:|@|handle|account|name|username|page)'
     or t ~ '(^|\s)@[a-z0-9_.]{3,}'
     or t ~ '\m(find|follow|add|look|search|hit|dm|message|text|call|contact|reach)\s+(me|us)\s+(up\s+)?(on|via|thru|through)\s+(insta|instagram|ig|facebook|fb|snap|snapchat|tiktok|linkedin|whatsapp|telegram|twitter|signal|discord|messenger)\M'
     or t ~ '\m(whatsapp|telegram|signal|discord|messenger|facebook|fb|insta|instagram|snapchat|tiktok)\s+me\M'
     or t ~ '\m(look|google)\s+(me|us)\M' or t ~ '\msearch\s+(for\s+)?(me|us)\M' then return 'contact'; end if;

  -- Taking it off the platform
  if t ~ '\m(off|outside)\s+(of\s+)?(the\s+)?(app|platform|site|website|lancenest)\M' or t ~ '\mpay\s+(me\s+|you\s+)?(in\s+)?cash\M'
     or t ~ '\mcash\s+(only|deal|payment|job)\M' or t ~ '\m(skip|avoid|dodge)\s+(the\s+)?(fee|fees|app|platform)\M' then return 'off_platform'; end if;
  return null;
end $$;
