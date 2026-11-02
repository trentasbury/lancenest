-- =====================================================================
-- 0098 (November 2, 2026): the "book it on LanceNest" agreement moves to sign-up, the way Upwork does it (one required
-- box agreeing to the Terms, which include the rule), with reminders in Messages. Proposals and listings no longer
-- check for a separate agreement, so the check is switched off here. The two triggers themselves are removed by the
-- SQL Editor file (a drop can't run from here); until then they do nothing.
-- platform_agreements now records each member's sign-up acceptance (wording version and time).
-- =====================================================================

create or replace function private.require_platform_agreement() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  return new;
end $$;
