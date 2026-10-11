-- Keep assigned-case visibility coupled to an active, server-controlled support membership.

create or replace function public.can_access_support_case(p_case_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.support_cases c
    join public.agreements a on a.id = c.agreement_id
    where c.id = p_case_id
      and (
        (select auth.uid()) in (a.organizer_id, a.provider_id)
        or (
          c.assigned_support_id = (select auth.uid())
          and exists (
            select 1 from public.account_roles ar
            where ar.user_id = c.assigned_support_id
              and ar.role = 'support'
              and ar.status = 'active'
          )
        )
      )
  );
$$;

revoke all on function public.can_access_support_case(uuid) from public, anon;
grant execute on function public.can_access_support_case(uuid) to authenticated;
