-- =====================================================================
-- 0104 (November 6, 2026): one member offer. Founding Member seats go from 100 to 500 (6 months of Pro free, once,
-- the same perk as Transition Pro and partner cards; see src/lib/freePro.ts). Partner cards are 6 months.
-- =====================================================================

alter table public.founding_members drop constraint founding_members_seat_check;
alter table public.founding_members add constraint founding_members_seat_check check (seat between 1 and 500);
