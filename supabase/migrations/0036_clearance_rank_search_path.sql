-- Security advisor: pin the search path on the clearance helper.
create or replace function private.clearance_rank(c text)
returns integer language sql immutable set search_path = '' as $$
  select case coalesce(c, 'none') when 'public_trust' then 1 when 'confidential' then 2 when 'secret' then 3 when 'top_secret' then 4 when 'ts_sci' then 5 else 0 end;
$$;
