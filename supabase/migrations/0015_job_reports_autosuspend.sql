-- =====================================================================
-- Member reports as a tripwire: 3 reports on a job pause it; 5 reports
-- across a company's jobs suspend the company. Admin is notified.
-- =====================================================================
create or replace function private.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare reporters integer; co uuid; co_reporters integer;
begin
  if new.target_type in ('post', 'comment') then
    select count(distinct reporter_id) into reporters from public.reports
     where target_type = new.target_type and target_id = new.target_id and status in ('open', 'reviewing');
    if reporters >= 3 then
      if new.target_type = 'post' then update public.network_posts set hidden = true where id = new.target_id;
      else update public.post_comments set hidden = true where id = new.target_id; end if;
    end if;
  elsif new.target_type = 'job' then
    select company_id into co from public.jobs where id = new.target_id;
    if co is null then return null; end if;
    select count(distinct reporter_id) into reporters from public.reports
     where target_type = 'job' and target_id = new.target_id and status in ('open', 'reviewing');
    if reporters >= 3 then
      update public.jobs set status = 'paused' where id = new.target_id and status = 'open';
    end if;
    select count(distinct r.reporter_id) into co_reporters from public.reports r join public.jobs j on j.id = r.target_id
     where r.target_type = 'job' and j.company_id = co and r.status in ('open', 'reviewing');
    if co_reporters >= 5 then
      update public.companies set is_verified = false, verification_status = 'pending',
             verification_note = 'Suspended automatically after multiple member reports — pending review.'
       where id = co and is_verified;
      update public.jobs set status = 'paused' where company_id = co and status = 'open';
    end if;
    if reporters = 3 or co_reporters = 5 then
      insert into public.notifications (profile_id, type, title, link)
      select id, 'report_alert', case when co_reporters = 5 then 'A company was suspended automatically after 5 member reports.' else 'A job was paused automatically after 3 member reports.' end, '/admin/reports'
        from public.profiles where role = 'admin';
    end if;
  end if;
  return null;
end $$;
