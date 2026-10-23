-- Company verification details (EIN, phone, state ID, role), review notes and billing fields are private.
-- Until now every column of companies was readable by anyone through the public API (the row policy is
-- "true" so company pages work). Members and visitors keep every public column; the private ones are read
-- only on the server (service role) and by admins through the app.
-- No data changes; reversible by granting the columns again.
revoke select on public.companies from anon, authenticated;
grant select (
  id, slug, name, logo_url, cover_url, industry, headquarters, website, about, mission, benefits, veteran_commitment,
  is_verified, verification_status, owner_id, plan, extra_job_slots, public_safety_status,
  skillbridge_org_name, skillbridge_status, training_featured, training_listing_active, created_at, updated_at
) on public.companies to anon, authenticated;
