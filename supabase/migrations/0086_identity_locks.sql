-- =====================================================================
-- 0086: a verified badge stays attached to the identity that was checked.
-- 1) A verified company can't rename itself or move its website to another domain (the company page already
--    blocks this; this closes the same door for direct API calls). Admins can still change both.
-- 2) When a verified member changes their name, admins are told (old and new name) so it can be checked against
--    the documents on file. The change itself still goes through (marriage, nicknames, typos).
-- =====================================================================

create or replace function private.url_host(u text) returns text
language sql immutable set search_path = 'public' as $$
  select nullif(lower(regexp_replace(regexp_replace(coalesce(u, ''), '^[a-z]+://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi')), '');
$$;

create or replace function private.lock_verified_company_identity() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare vhost text; nhost text;
begin
  if auth.uid() is null or private.is_admin() or not old.is_verified then return new; end if;
  if new.name is distinct from old.name then
    raise exception 'company_name_locked' using errcode = 'P0024', hint = 'A verified company''s name can only be changed by LanceNest support.';
  end if;
  if new.website is distinct from old.website and new.website is not null then
    vhost := coalesce(private.url_host(old.verification_details ->> 'website'), private.url_host(old.website));
    nhost := private.url_host(new.website);
    if vhost is not null and nhost is distinct from vhost and (nhost is null or right(nhost, length(vhost) + 1) <> '.' || vhost) then
      raise exception 'company_website_locked' using errcode = 'P0024', hint = 'A verified company''s website must stay on its verified domain.';
    end if;
  end if;
  return new;
end $$;

create trigger companies_lock_verified_identity
  before update of name, website on public.companies
  for each row execute function private.lock_verified_company_identity();

create or replace function private.flag_verified_name_change() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null or private.is_admin() or new.full_name is not distinct from old.full_name then return new; end if;
  if new.role <> 'veteran' or not exists (select 1 from public.veteran_profiles v where v.profile_id = new.id and v.verification_status = 'verified') then
    return new;
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, details)
  values (null, 'verified_name_changed', 'profile', new.id, jsonb_build_object('from', old.full_name, 'to', new.full_name));
  insert into public.notifications (profile_id, type, title, link)
  select a.id, 'report_alert', 'A verified member changed their name from “' || coalesce(old.full_name, '') || '” to “' || coalesce(new.full_name, '') || '”. Check it against their documents.', '/admin/verifications'
    from public.profiles a where a.role = 'admin';
  return new;
end $$;

create trigger profiles_flag_verified_name_change
  after update of full_name on public.profiles
  for each row execute function private.flag_verified_name_change();

-- The private schema isn't exposed through the API, and trigger functions can't be called directly.
