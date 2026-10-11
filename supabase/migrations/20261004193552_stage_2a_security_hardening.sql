-- Remove the redundant Pactset event trigger. The project-level ensure_rls
-- trigger remains enabled and is the single automatic-RLS boundary.
drop event trigger if exists pactset_auto_enable_public_rls;
drop function if exists private.auto_enable_public_rls();

-- The platform trigger may execute its helper, but API roles must not expose it.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Keep future Data API exposure opt-in.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- Remove inherited broad privileges before restoring Pactset's exact surface.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.account_roles to authenticated;
grant select, insert, update on public.provider_profiles to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.requests to authenticated;
grant select on public.offers, public.offer_versions, public.offer_reservations, public.agreements, public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
