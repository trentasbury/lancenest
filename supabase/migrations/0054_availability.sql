-- What employers need to see first: is this member open to work, and at what pay?
alter table public.veteran_profiles add column if not exists availability text not null default 'open_soon' check (availability in ('open_now', 'open_soon', 'not_looking'));
alter table public.veteran_profiles add column if not exists target_pay text check (char_length(target_pay) <= 60);
grant update (availability, target_pay) on public.veteran_profiles to authenticated;
