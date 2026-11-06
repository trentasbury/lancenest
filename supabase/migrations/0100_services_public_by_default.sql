-- 0100 (November 6, 2026): new service listings are on the public Hire page by default, so anyone (homeowners,
-- small businesses, companies) can find and book members, not just other members. Members can still untick it.
-- The public page shows first name + last initial, city and the service; contact details open only after booking.
alter table public.service_listings alter column public_listing set default true;
