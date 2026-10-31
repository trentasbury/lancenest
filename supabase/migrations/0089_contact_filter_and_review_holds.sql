-- =====================================================================
-- 0089 (approved October 31, 2026)
-- 1) A stronger contact filter (used before a booking is paid, and on listings, projects and proposals):
--    phone numbers written as words or with spaced digits, spaced-out emails, "find me on Instagram/Facebook",
--    "WhatsApp me", "google me", PayPal, Apple Pay, wire/crypto, and "pay me directly". It also stops two false
--    alarms: an email provider's name alone ("the project outlook") and "my Instagram ..." with no handle.
-- 2) Reviews from client accounts under 30 days old are held until an admin approves them (a freelancer can't buy
--    themselves 5 stars through a second account). Held reviews don't show or count toward ratings.
-- =====================================================================

create or replace function private.contact_signal(txt text) returns text
language plpgsql immutable set search_path = '' as $$
declare t text; digits text; nospace text;
begin
  if txt is null or btrim(txt) = '' then return null; end if;
  t := lower(txt);
  t := regexp_replace(t, '(https?://)?(www\.)?lancenest\.com[^\s]*', ' ', 'g');
  t := regexp_replace(t, '\m(asp|vb|ado)\.net\M', ' ', 'g');

  -- Email
  if t ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return 'email'; end if;
  if t ~ '\m(gmail|yahoo|hotmail|outlook|icloud|proton(mail)?|aol)\M\s*(\.|dot\M|com\M)'
     or t ~ '\mat\s*[\]\)]?\s*(gmail|yahoo|hotmail|outlook|icloud|proton(mail)?|aol)\M'
     or t ~ '\mdot\s*(com|net|org)\M' or t ~ '[\(\[]\s*at\s*[\)\]]' then return 'email'; end if;
  nospace := regexp_replace(t, '[[:space:]]+', '', 'g');
  if nospace ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return 'email'; end if;

  -- Phone: formatted, then written as words or with spaced digits
  if t ~ '(^|[^0-9$,.])(\+?1[\s.-]?)?\(?[2-9][0-9]{2}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}([^0-9]|$)' then return 'phone'; end if;
  digits := t;
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

-- 2) Held reviews
alter table public.reviews add column held boolean not null default false;

create or replace function private.hold_new_client_reviews() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare r record;
begin
  select role, created_at into r from public.profiles where id = new.reviewer_id;
  new.held := coalesce(r.role = 'client' and r.created_at > now() - interval '30 days', false);
  if new.held then
    insert into public.notifications (profile_id, type, title, link)
    select a.id, 'report_alert', 'A review from a new client account is waiting for your approval.', '/admin/reviews'
      from public.profiles a where a.role = 'admin';
  end if;
  return new;
end $$;

create trigger reviews_hold_new_clients
  before insert on public.reviews
  for each row execute function private.hold_new_client_reviews();

alter policy reviews_read on public.reviews using (
  (not held and private.is_verified_member()) or reviewer_id = (select auth.uid()) or private.is_admin()
);
alter policy reviews_read_clients on public.reviews using (
  private.is_active_client()
  and (reviewer_id = (select auth.uid())
       or (not held and (reviewee_id = (select auth.uid()) or private.client_can_see(reviewee_id))))
);

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
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id and not r.held
   where k.freelancer_id = p and k.status = 'completed' and private.is_verified_member()
   order by k.updated_at desc
   limit 20;
$$;

create or replace function public.verified_work_summary(ids uuid[])
returns table (profile_id uuid, completed integer, avg_rating numeric)
language sql stable security definer set search_path = 'public' as $$
  select k.freelancer_id, count(distinct k.id)::integer, round(avg(r.rating)::numeric, 1)
    from public.contracts k
    left join public.reviews r on r.contract_id = k.id and r.reviewee_id = k.freelancer_id and not r.held
   where k.freelancer_id = any(ids) and k.status = 'completed' and (private.is_verified_member() or private.is_active_client())
   group by k.freelancer_id;
$$;
