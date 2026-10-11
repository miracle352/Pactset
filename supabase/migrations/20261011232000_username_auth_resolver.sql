-- Resolve a normalized username for the server-side Auth adapter without granting
-- the service role broad profile-table reads. Browser roles cannot execute this.

create or replace function public.resolve_username_auth_user(p_username text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.username = private.normalize_username(p_username)
  limit 1;
$$;

revoke all on function public.resolve_username_auth_user(text) from public, anon, authenticated;
grant execute on function public.resolve_username_auth_user(text) to service_role;

comment on function public.resolve_username_auth_user(text) is
  'Service-only username resolver for account-auth. Returns no email or public profile data.';
