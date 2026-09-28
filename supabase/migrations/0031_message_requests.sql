-- =====================================================================
-- Message requests (LinkedIn-style): one message until the recipient
-- accepts or replies. Connections (mutual follows) and freelance contract
-- partners message freely. Existing conversations stay active.
-- =====================================================================
alter table public.conversations add column if not exists status text not null default 'active';
alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations add constraint conversations_status_check check (status in ('request', 'active', 'declined'));
alter table public.conversations add column if not exists requested_by uuid references public.profiles (id) on delete set null;

create or replace function private.message_request_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; other uuid; sent integer;
begin
  select status, requested_by into c from public.conversations where id = new.conversation_id;
  if c.status = 'active' or c.requested_by is null then return new; end if;
  select profile_id into other from public.conversation_participants where conversation_id = new.conversation_id and profile_id <> new.sender_id limit 1;
  -- Became connected, or working together on a contract, since the request: unlock.
  if private.are_connected(new.sender_id, other)
     or exists (select 1 from public.contracts k where (k.client_id = new.sender_id and k.freelancer_id = other) or (k.client_id = other and k.freelancer_id = new.sender_id)) then
    update public.conversations set status = 'active' where id = new.conversation_id;
    return new;
  end if;
  if new.sender_id <> c.requested_by then
    -- The recipient replied: that's an acceptance.
    update public.conversations set status = 'active' where id = new.conversation_id;
    return new;
  end if;
  if c.status = 'declined' then raise exception 'request_declined' using errcode = 'P0016'; end if;
  select count(*) into sent from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id;
  if sent >= 1 then raise exception 'request_pending' using errcode = 'P0015'; end if;
  return new;
end $$;
revoke execute on function private.message_request_rules() from public, anon, authenticated;
drop trigger if exists messages_request_rules on public.messages;
create trigger messages_request_rules before insert on public.messages for each row execute function private.message_request_rules();
