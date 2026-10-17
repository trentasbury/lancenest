-- =====================================================================
-- LanceNest — photo ID alongside the service document
-- A reviewer compares a government photo ID (driver's license, state ID or
-- passport) with the DD-214 / LES / orders to confirm both belong to the
-- member. Both files are deleted when the review is decided, or after 30 days.
-- =====================================================================

alter table public.verification_requests
  add column if not exists id_document_path text,
  add column if not exists id_type text,
  add column if not exists member_note text;

alter table public.verification_requests
  drop constraint if exists verification_requests_id_type_check,
  add constraint verification_requests_id_type_check
    check (id_type is null or id_type in ('drivers_license', 'state_id', 'passport', 'passport_card'));

alter table public.verification_requests
  drop constraint if exists verification_requests_member_note_check,
  add constraint verification_requests_member_note_check
    check (member_note is null or char_length(member_note) <= 300);

-- File paths must sit in the member's own storage folder, so a request can never
-- point the reviewer (or the delete-on-decision step) at someone else's file.
alter table public.verification_requests
  drop constraint if exists verification_requests_document_path_check,
  add constraint verification_requests_document_path_check
    check (document_path is null or document_path like profile_id::text || '/%'),
  drop constraint if exists verification_requests_id_document_path_check,
  add constraint verification_requests_id_document_path_check
    check (id_document_path is null or id_document_path like profile_id::text || '/%');

comment on column public.verification_requests.id_document_path is
  'Private storage path of the member''s photo ID (verification-docs bucket). Cleared and the file deleted when the request is decided or expires.';
