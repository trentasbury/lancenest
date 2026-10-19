-- Free freelancers send 5 proposals per calendar month (was 10). Extra proposals are bought in packs and never expire.
-- Credits live in their own table so only the member can read them; only the server can change them.
create table if not exists public.proposal_credits (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);
alter table public.proposal_credits enable row level security;
create policy proposal_credits_own on public.proposal_credits for select to authenticated using (profile_id = auth.uid());
revoke insert, update, delete on public.proposal_credits from anon, authenticated;
grant select on public.proposal_credits to authenticated;

-- One row per paid pack; the unique Stripe session makes applying a payment safe to repeat.
create table if not exists public.proposal_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  credits integer not null check (credits > 0),
  amount_cents integer not null,
  stripe_checkout_session_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.proposal_pack_purchases enable row level security;
revoke all on public.proposal_pack_purchases from anon, authenticated;

-- Records a paid pack and adds its credits, once per Stripe session (server only).
create or replace function public.apply_proposal_pack(p_session text, p_profile uuid, p_credits integer, p_amount integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.proposal_pack_purchases (profile_id, credits, amount_cents, stripe_checkout_session_id)
  values (p_profile, p_credits, p_amount, p_session)
  on conflict (stripe_checkout_session_id) do nothing;
  if not found then return false; end if;
  insert into public.proposal_credits (profile_id, credits) values (p_profile, p_credits)
  on conflict (profile_id) do update set credits = public.proposal_credits.credits + excluded.credits, updated_at = now();
  return true;
end $$;
revoke execute on function public.apply_proposal_pack(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_proposal_pack(text, uuid, integer, integer) to service_role;

-- Proposal rules: on the free plan, 5 per calendar month, then one bought credit per extra proposal
-- (paid plans unlimited). Freelancers may only withdraw; clients may only shortlist/decline;
-- "accepted" is set by the server when a contract starts.
create or replace function private.proposal_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare vplan text; used integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.freelance_projects where id = new.project_id and status = 'open') then
      raise exception 'project_closed' using errcode = 'P0005';
    end if;
    select plan into vplan from public.veteran_profiles where profile_id = new.freelancer_id;
    if coalesce(vplan, 'free') = 'free' then
      select count(*) into used from public.proposals where freelancer_id = new.freelancer_id and created_at >= date_trunc('month', now());
      if used >= 5 then
        update public.proposal_credits set credits = credits - 1, updated_at = now() where profile_id = new.freelancer_id and credits > 0;
        if not found then raise exception 'proposal_limit' using errcode = 'P0006'; end if;
      end if;
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if auth.uid() = old.freelancer_id and new.status <> 'withdrawn' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if auth.uid() <> old.freelancer_id and new.status not in ('shortlisted', 'declined') then raise exception 'not_allowed' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke execute on function private.proposal_rules() from public, anon, authenticated;
