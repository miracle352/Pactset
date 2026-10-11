-- Permit several verified Testnet wallets per account while keeping exactly one active.
-- Existing escrows retain immutable payer/payee keys; newly created escrows use the
-- caller's currently active, freshly verified wallet.

alter table public.wallet_connections add column active boolean not null default true;
alter table public.wallet_connections drop constraint wallet_connections_user_id_network_key;
create unique index wallet_connections_one_active_user_network_idx
  on public.wallet_connections(user_id, network) where active;

create or replace function public.activate_wallet_connection(
  p_user_id uuid, p_public_key text, p_network text,
  p_wallet_provider text, p_verified_at timestamptz
)
returns public.wallet_connections
language plpgsql security definer set search_path = ''
as $$
declare v_existing public.wallet_connections; v_connection public.wallet_connections;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  if p_network <> 'TESTNET' or p_public_key !~ '^G[A-Z2-7]{55}$' then raise exception 'Invalid Testnet wallet'; end if;

  select * into v_existing from public.wallet_connections
    where public_key = p_public_key and network = p_network for update;
  if v_existing.id is not null and v_existing.user_id <> p_user_id then
    raise exception 'Wallet already belongs to another account' using errcode = '23505';
  end if;

  update public.wallet_connections set active = false, updated_at = p_verified_at
    where user_id = p_user_id and network = p_network and active;
  if v_existing.id is not null then
    update public.wallet_connections
      set active = true, wallet_provider = left(p_wallet_provider, 48),
          verified_at = p_verified_at, updated_at = p_verified_at
      where id = v_existing.id returning * into v_connection;
  else
    insert into public.wallet_connections(user_id, public_key, network, wallet_provider, verified_at, updated_at, active)
      values (p_user_id, p_public_key, p_network, left(p_wallet_provider, 48), p_verified_at, p_verified_at, true)
      returning * into v_connection;
  end if;
  return v_connection;
end;
$$;

revoke all on function public.activate_wallet_connection(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.activate_wallet_connection(uuid,text,text,text,timestamptz) to service_role;
