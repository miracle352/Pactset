-- Fix participant reads for offer details without broadening request visibility.
-- The original offer-version policy joined requests before checking the direct
-- provider relationship. Because providers intentionally cannot list arbitrary
-- request rows, that join hid their own offer terms and produced a false 404.

drop policy if exists versions_participants_select on public.offer_versions;
create policy versions_participants_select on public.offer_versions
for select to authenticated
using (
  exists (
    select 1
    from public.offers o
    where o.id = offer_versions.offer_id
      and (
        o.provider_id = (select auth.uid())
        or exists (
          select 1
          from public.requests r
          where r.id = o.request_id
            and r.organizer_id = (select auth.uid())
        )
      )
  )
);
