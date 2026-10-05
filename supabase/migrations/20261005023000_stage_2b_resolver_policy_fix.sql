-- Avoid recursive agreement RLS while preserving a narrow disclosed-resolver
-- read boundary. The function checks the caller, uses an empty search_path,
-- and is executable only by authenticated users.

drop policy if exists agreements_disclosed_resolver_support_read on public.agreements;

create or replace function public.can_resolve_agreement(p_agreement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.agreement_escrows e
    join public.wallet_connections w
      on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    where e.agreement_id = p_agreement_id
      and w.user_id = (select auth.uid())
      and ar.role = 'support'
      and ar.status = 'active'
  );
$$;

revoke all on function public.can_resolve_agreement(uuid) from public, anon;
grant execute on function public.can_resolve_agreement(uuid) to authenticated;

create policy agreements_disclosed_resolver_support_read on public.agreements
  for select to authenticated
  using (public.can_resolve_agreement(id));

comment on function public.can_resolve_agreement(uuid) is
  'Checks whether the authenticated caller has server-assigned support and owns the disclosed resolver wallet for one agreement.';
