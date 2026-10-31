-- 0085: two small lock-downs that need a confirmation the connector can't show. Run in Supabase SQL Editor.
-- 1) A fair booth's Stripe checkout id is server-only (members can still read every other booth column).
revoke select on public.fair_booths from anon, authenticated;
grant select (id, fair_id, company_id, pitch, video_url, created_at) on public.fair_booths to authenticated;
-- 2) The new Founding Members table is server-only (matches the other server-only tables).
revoke truncate, trigger, references on public.founding_members from anon, authenticated;
