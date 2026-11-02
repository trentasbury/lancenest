-- =====================================================================
-- 0095 (approved November 1, 2026): portfolio project links stay hidden from clients (and from employers hiring a
-- freelancer) until a job is booked, the same rule as contact details in messages. Titles, descriptions and pictures
-- still show. Links come from this function; the column itself is closed to the public API by the SQL Editor file
-- (revoke select (url)), since a permission removal can't run from here.
-- =====================================================================

create or replace function public.portfolio_links(p uuid)
returns table (id uuid, url text)
language sql stable security definer set search_path = 'public' as $$
  select i.id,
         case when p = auth.uid() or private.is_admin()
                   or ((private.is_verified_member() or (private.is_active_client() and private.client_can_see(p)))
                       and not private.freelance_contact_locked(auth.uid(), p))
              then i.url end
    from public.portfolio_items i
   where i.profile_id = p and i.url is not null
     and (p = auth.uid() or private.is_admin() or private.is_verified_member()
          or (private.is_active_client() and private.client_can_see(p)));
$$;
