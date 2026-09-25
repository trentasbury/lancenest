-- =====================================================================
-- LanceNest — admin two-step enforcement + database rate limits
-- =====================================================================

-- Admin powers in row-level security now require a session that passed
-- two-step verification (AAL2). A stolen password alone grants nothing extra.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.app_role() = 'admin' and (auth.jwt() ->> 'aal') = 'aal2', false);
$$;

-- Per-member limits on write actions. System/seed inserts (no signed-in user) are exempt.
create or replace function private.rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  recent integer := 0;
  lim integer;
begin
  if actor is null then return new; end if;
  if tg_table_name = 'network_posts' then
    lim := 20; select count(*) into recent from public.network_posts where author_id = actor and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'post_comments' then
    lim := 60; select count(*) into recent from public.post_comments where author_id = actor and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'messages' then
    lim := 40; select count(*) into recent from public.messages where sender_id = actor and created_at > now() - interval '10 minutes';
  elsif tg_table_name = 'reports' then
    lim := 20; select count(*) into recent from public.reports where reporter_id = actor and created_at > now() - interval '1 day';
  elsif tg_table_name = 'user_follows' then
    lim := 150; select count(*) into recent from public.user_follows where follower_id = actor and created_at > now() - interval '1 day';
  elsif tg_table_name = 'applications' then
    lim := 50; select count(*) into recent from public.applications where profile_id = actor and applied_at > now() - interval '1 day';
  elsif tg_table_name = 'verification_requests' then
    lim := 5; select count(*) into recent from public.verification_requests where profile_id = actor and created_at > now() - interval '1 day';
  elsif tg_table_name = 'companies' then
    lim := 3; select count(*) into recent from public.companies where owner_id = actor and created_at > now() - interval '1 day';
  else
    return new;
  end if;
  if recent >= lim then
    raise exception 'rate_limited' using errcode = 'P0002', hint = 'Too many actions in a short time.';
  end if;
  return new;
end $$;
revoke execute on function private.rate_limit() from public, anon, authenticated;

create index if not exists post_comments_author_idx on public.post_comments (author_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at);

create trigger rate_limit_posts before insert on public.network_posts for each row execute function private.rate_limit();
create trigger rate_limit_comments before insert on public.post_comments for each row execute function private.rate_limit();
create trigger rate_limit_messages before insert on public.messages for each row execute function private.rate_limit();
create trigger rate_limit_reports before insert on public.reports for each row execute function private.rate_limit();
create trigger rate_limit_follows before insert on public.user_follows for each row execute function private.rate_limit();
create trigger rate_limit_applications before insert on public.applications for each row execute function private.rate_limit();
create trigger rate_limit_verifications before insert on public.verification_requests for each row execute function private.rate_limit();
create trigger rate_limit_companies before insert on public.companies for each row execute function private.rate_limit();
