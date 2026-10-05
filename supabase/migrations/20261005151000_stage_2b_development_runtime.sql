-- pactset-development Testnet runtime only. These are public ledger/user identifiers,
-- never signing credentials. A future production environment must configure its own row.

do $$
declare
  v_resolver_user uuid := 'ec2316e4-c9c5-4533-bc6a-739d491e2b9e';
  v_resolver_public_key text := 'GCD7NO6RYQWXX2TBX3J2ZEO6DKHHMCC7EGAJG2ZZWT5MRSA27RV6C7ZK';
begin
  if not exists (
    select 1 from public.account_roles
    where user_id = v_resolver_user and role = 'support' and status = 'active'
  ) then raise exception 'Development resolver support membership is missing'; end if;
  if not exists (
    select 1 from public.wallet_connections
    where user_id = v_resolver_user and network = 'TESTNET' and public_key = v_resolver_public_key
  ) then raise exception 'Development resolver wallet ownership is not verified'; end if;

  insert into public.escrow_runtime_registry(
    network, wasm_hash, resolver_user_id, resolver_public_key, active, installed_at
  ) values (
    'TESTNET',
    '16bbec4ac902d7ad0256ea75404df8c7f45f5e4dd3cd0fab8f7fa9a0cd12d635',
    v_resolver_user,
    v_resolver_public_key,
    true,
    now()
  )
  on conflict (network) do update set
    wasm_hash = excluded.wasm_hash,
    resolver_user_id = excluded.resolver_user_id,
    resolver_public_key = excluded.resolver_public_key,
    active = excluded.active,
    installed_at = excluded.installed_at,
    updated_at = now();
end;
$$;
