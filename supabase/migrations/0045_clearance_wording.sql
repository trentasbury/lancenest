-- Job-match reason: clearances are self-reported, so don't state that a member "meets" one.
do $$ begin
  execute replace(pg_get_functiondef('public.recommended_jobs(integer)'::regprocedure), '''You meet the clearance''', '''Matches your stated clearance''');
end $$;
