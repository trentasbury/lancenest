-- =====================================================================
-- LanceNest Freelance — Release A: freelancer profiles, portfolios,
-- client projects, proposals (verified veterans only)
-- =====================================================================
create table public.freelancer_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  bio text check (char_length(bio) <= 3000),
  hourly_rate integer check (hourly_rate is null or hourly_rate between 10 and 1000),
  available boolean not null default true,
  clearance_work boolean not null default false,
  vosb boolean not null default false,
  sdvosb boolean not null default false,
  sam_uei text check (sam_uei is null or char_length(sam_uei) = 12),
  stripe_account_id text,                 -- set by the server only
  payouts_enabled boolean not null default false, -- set by the server only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger freelancer_profiles_updated before update on public.freelancer_profiles for each row execute function private.set_updated_at();

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 1500),
  url text check (url is null or url ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index portfolio_items_profile_idx on public.portfolio_items (profile_id, created_at desc);

create table public.freelance_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  title text not null check (char_length(title) between 4 and 140),
  description text not null check (char_length(description) between 20 and 8000),
  category text,
  budget_type text not null default 'fixed' check (budget_type in ('fixed', 'hourly')),
  budget_min integer check (budget_min is null or budget_min > 0),
  budget_max integer check (budget_max is null or budget_max > 0),
  clearance_required text not null default 'none'
    check (clearance_required in ('none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  search tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_max >= budget_min)
);
create index freelance_projects_status_idx on public.freelance_projects (status, created_at desc);
create index freelance_projects_client_idx on public.freelance_projects (client_id);
create index freelance_projects_search_idx on public.freelance_projects using gin (search);
create trigger freelance_projects_updated before update on public.freelance_projects for each row execute function private.set_updated_at();

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.freelance_projects (id) on delete cascade,
  freelancer_id uuid not null references public.profiles (id) on delete cascade,
  cover_letter text not null check (char_length(cover_letter) between 30 and 5000),
  bid_amount integer not null check (bid_amount > 0),
  timeline text check (char_length(timeline) <= 120),
  status text not null default 'submitted' check (status in ('submitted', 'shortlisted', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, freelancer_id)
);
create index proposals_freelancer_idx on public.proposals (freelancer_id, created_at desc);
create trigger proposals_updated before update on public.proposals for each row execute function private.set_updated_at();

create or replace function private.owns_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.freelance_projects fp where fp.id = p and fp.client_id = auth.uid());
$$;

create or replace function private.is_verified_veteran()
returns boolean language sql stable security definer set search_path = public as $$
  select private.app_role() = 'veteran' and private.is_verified_member();
$$;

-- Proposal rules: 10 per calendar month on the free plan (Pro/Federal Pro unlimited);
-- freelancers may only withdraw; clients may only shortlist/decline; "accepted" is set by the server when a contract starts.
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
      if used >= 10 then raise exception 'proposal_limit' using errcode = 'P0006'; end if;
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
create trigger proposals_rules before insert or update on public.proposals for each row execute function private.proposal_rules();

-- Notifications
create or replace function private.on_proposal_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare client uuid; ptitle text;
begin
  select client_id, title into client, ptitle from public.freelance_projects where id = new.project_id;
  if tg_op = 'INSERT' then
    perform private.notify(client, new.freelancer_id, 'proposal', 'sent a proposal for “' || ptitle || '”', '/freelance/projects/' || new.project_id);
  elsif new.status is distinct from old.status and new.status in ('shortlisted', 'declined') then
    perform private.notify(new.freelancer_id, client, 'proposal_status',
      case when new.status = 'shortlisted' then 'shortlisted your proposal for “' || ptitle || '”' else 'passed on your proposal for “' || ptitle || '”' end,
      '/freelance/projects/' || new.project_id);
  end if;
  return null;
end $$;
revoke execute on function private.on_proposal_change() from public, anon, authenticated;
create trigger proposals_notify after insert or update of status on public.proposals for each row execute function private.on_proposal_change();

-- A freelancer who sent a proposal becomes visible to (and free to message by) that client, like an applicant.
create or replace function private.employer_can_see(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.is_verified and c.plan in ('professional', 'federal', 'enterprise'))
          and exists (select 1 from public.veteran_profiles v where v.profile_id = target and v.verification_status = 'verified'))
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = j.company_id
                 where a.profile_id = target and c.owner_id = auth.uid())
      or exists (select 1 from public.proposals pr join public.freelance_projects fp on fp.id = pr.project_id
                 where pr.freelancer_id = target and fp.client_id = auth.uid())
      or exists (select 1 from public.conversation_participants p1 join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
                 where p1.profile_id = auth.uid() and p2.profile_id = target);
$$;

-- Row-level security
alter table public.freelancer_profiles enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.freelance_projects enable row level security;
alter table public.proposals enable row level security;

create policy freelancer_profiles_read on public.freelancer_profiles for select to authenticated using (profile_id = auth.uid() or private.is_verified_member());
create policy freelancer_profiles_insert on public.freelancer_profiles for insert to authenticated with check (profile_id = auth.uid() and private.is_verified_veteran());
create policy freelancer_profiles_update on public.freelancer_profiles for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke insert, update on public.freelancer_profiles from anon, authenticated;
grant insert (profile_id, title, bio, hourly_rate, available, clearance_work, vosb, sdvosb, sam_uei) on public.freelancer_profiles to authenticated;
grant update (title, bio, hourly_rate, available, clearance_work, vosb, sdvosb, sam_uei) on public.freelancer_profiles to authenticated;

create policy portfolio_read on public.portfolio_items for select to authenticated using (profile_id = auth.uid() or private.is_verified_member());
create policy portfolio_write on public.portfolio_items for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid() and private.is_verified_veteran());

create policy projects_read on public.freelance_projects for select to authenticated using (client_id = auth.uid() or private.is_admin() or (status = 'open' and private.is_verified_member()));
create policy projects_insert on public.freelance_projects for insert to authenticated
  with check (client_id = auth.uid() and private.app_role() = 'employer'
              and exists (select 1 from public.companies c where c.owner_id = auth.uid() and c.is_verified and c.id = company_id));
create policy projects_update on public.freelance_projects for update to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy projects_delete on public.freelance_projects for delete to authenticated using (client_id = auth.uid());
revoke update on public.freelance_projects from anon, authenticated;
grant update (title, description, category, budget_type, budget_min, budget_max, clearance_required, status) on public.freelance_projects to authenticated;

create policy proposals_read on public.proposals for select to authenticated using (freelancer_id = auth.uid() or private.owns_project(project_id) or private.is_admin());
create policy proposals_insert on public.proposals for insert to authenticated
  with check (freelancer_id = auth.uid() and private.is_verified_veteran()
              and exists (select 1 from public.freelancer_profiles f where f.profile_id = auth.uid()));
create policy proposals_update on public.proposals for update to authenticated
  using (freelancer_id = auth.uid() or private.owns_project(project_id)) with check (freelancer_id = auth.uid() or private.owns_project(project_id));
revoke update on public.proposals from anon, authenticated;
grant update (status) on public.proposals to authenticated;
