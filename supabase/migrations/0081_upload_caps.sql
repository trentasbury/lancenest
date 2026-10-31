-- 0081: Security review 3. Daily upload caps so one account can't fill the file storage, and an index for the
-- page-view counter's per-visitor daily cap. Policies are changed with ALTER POLICY (nothing dropped).

-- Files the signed-in account put in a bucket in the last 24 hours (their own folder only).
create or replace function private.uploads_today(p_bucket text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = p_bucket
    and o.name like ((select auth.uid())::text || '/%')
    and o.created_at > now() - interval '24 hours';
$$;
revoke all on function private.uploads_today(text) from public, anon;
grant execute on function private.uploads_today(text) to authenticated;

-- Post photos: 40 a day. Verification documents and résumés: 15 a day. Profile photos and logos: 15 a day.
alter policy lancenest_post_media_insert on storage.objects with check (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today('post-media') < 40);
alter policy lancenest_private_docs_insert on storage.objects with check (
  bucket_id = any (array['resumes', 'verification-docs']) and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today(bucket_id) < 15);
alter policy lancenest_public_uploads_insert on storage.objects with check (
  bucket_id = any (array['avatars', 'company-logos']) and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today(bucket_id) < 15);

-- The page-view counter checks how many views an anonymous visitor code has today.
create index if not exists page_views_visitor_day_idx on public.page_views (visitor, created_at);
