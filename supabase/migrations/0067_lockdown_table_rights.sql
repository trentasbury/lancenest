-- 0067: Lockdown. The site's database roles (anon = visitors, authenticated = members) never need to empty a whole
-- table or attach triggers; row security doesn't cover either, so take both rights away (now and for new tables).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke truncate, trigger on tables from anon, authenticated;
