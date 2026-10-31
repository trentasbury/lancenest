-- 0085: a fair booth's Stripe checkout id is server-only (members can read every other booth column).
-- Run in Supabase SQL Editor (the revoke needs a confirmation the connector can't show).
revoke select on public.fair_booths from anon, authenticated;
grant select (id, fair_id, company_id, pitch, video_url, created_at) on public.fair_booths to authenticated;
