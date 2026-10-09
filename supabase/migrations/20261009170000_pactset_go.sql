-- Pactset Go ledger projection. Server writes only; contract state remains authoritative.

create table public.pactset_go_runtime_registry (
  id uuid primary key default gen_random_uuid(),
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  contract_version integer not null check (contract_version > 0),
  wasm_hash text not null check (wasm_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default false,
  max_bookings integer not null default 8 check (max_bookings between 2 and 8),
  created_at timestamptz not null default now()
);
create unique index pactset_go_one_active_runtime_idx on public.pactset_go_runtime_registry(network) where active;

create table public.pactset_go_bundles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  asset_id uuid not null references public.test_asset_registry(id) on delete restrict,
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  bundle_hash text not null unique check (bundle_hash ~ '^[0-9a-f]{64}$'),
  contract_address text unique check (contract_address is null or contract_address ~ '^C[A-Z2-7]{55}$'),
  contract_version integer not null check (contract_version > 0),
  activation_deadline timestamptz not null,
  total_amount bigint not null check (total_amount > 0),
  status text not null default 'collecting_acceptances' check (status in ('collecting_acceptances','awaiting_funds','ready_to_activate','activation_pending','active','expired','refundable','refunded','cancelled','failed')),
  deployment_tx_hash text unique check (deployment_tx_hash is null or deployment_tx_hash ~ '^[0-9a-f]{64}$'),
  reserve_tx_hash text unique check (reserve_tx_hash is null or reserve_tx_hash ~ '^[0-9a-f]{64}$'),
  activation_tx_hash text unique check (activation_tx_hash is null or activation_tx_hash ~ '^[0-9a-f]{64}$'),
  refund_tx_hash text unique check (refund_tx_hash is null or refund_tx_hash ~ '^[0-9a-f]{64}$'),
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (activation_deadline > created_at)
);

create table public.pactset_go_bookings (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.pactset_go_bundles(id) on delete restrict,
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  agreement_version integer not null check (agreement_version > 0),
  agreement_hash text not null check (agreement_hash ~ '^[0-9a-f]{64}$'),
  escrow_id uuid not null references public.agreement_escrows(id) on delete restrict,
  escrow_contract_address text not null check (escrow_contract_address ~ '^C[A-Z2-7]{55}$'),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  provider_public_key text not null check (provider_public_key ~ '^G[A-Z2-7]{55}$'),
  amount bigint not null check (amount > 0),
  consent_status text not null default 'pending' check (consent_status in ('pending','pending_on_chain','accepted','revoked','expired')),
  consent_tx_hash text unique check (consent_tx_hash is null or consent_tx_hash ~ '^[0-9a-f]{64}$'),
  consented_at timestamptz,
  unique(bundle_id, agreement_id),
  unique(bundle_id, escrow_id)
);

create unique index pactset_go_agreement_one_open_bundle_idx on public.pactset_go_bookings(agreement_id)
where consent_status in ('pending','pending_on_chain','accepted');
create index pactset_go_bundles_event_idx on public.pactset_go_bundles(event_id, created_at desc);
create index pactset_go_bookings_provider_idx on public.pactset_go_bookings(provider_id, consent_status);

create table public.pactset_go_transactions (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.pactset_go_bundles(id) on delete restrict,
  booking_id uuid references public.pactset_go_bookings(id) on delete restrict,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  actor_public_key text not null check (actor_public_key ~ '^G[A-Z2-7]{55}$'),
  kind text not null check (kind in ('contract_deploy','consent','revoke','reserve','activate','expire','refund','cancel')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 160),
  submitted_xdr text,
  tx_hash text unique check (tx_hash is null or tx_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'prepared' check (status in ('prepared','pending','confirmed','failed','expired')),
  ledger integer check (ledger is null or ledger > 0),
  action_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  prepared_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index pactset_go_transactions_pending_idx on public.pactset_go_transactions(status, initiated_by);

alter table public.pactset_go_runtime_registry enable row level security;
alter table public.pactset_go_bundles enable row level security;
alter table public.pactset_go_bookings enable row level security;
alter table public.pactset_go_transactions enable row level security;
revoke all on public.pactset_go_runtime_registry, public.pactset_go_bundles, public.pactset_go_bookings, public.pactset_go_transactions from public, anon, authenticated;
grant select on public.pactset_go_runtime_registry to authenticated;
grant select on public.pactset_go_bundles, public.pactset_go_bookings, public.pactset_go_transactions to authenticated;
grant select, insert, update on public.pactset_go_runtime_registry, public.pactset_go_bundles, public.pactset_go_bookings, public.pactset_go_transactions to service_role;

create or replace function public.can_access_pactset_go_bundle(p_bundle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pactset_go_bundles b where b.id = p_bundle_id and b.organizer_id = (select auth.uid()))
  or exists (select 1 from public.pactset_go_bookings b where b.bundle_id = p_bundle_id and b.provider_id = (select auth.uid()))
  or exists (
    select 1 from public.pactset_go_bookings b
    join public.support_cases c on c.agreement_id = b.agreement_id
    join public.account_roles r on r.user_id = c.assigned_support_id and r.role = 'support' and r.status = 'active'
    where b.bundle_id = p_bundle_id and c.assigned_support_id = (select auth.uid()) and c.status in ('assigned','under_review')
  );
$$;
revoke all on function public.can_access_pactset_go_bundle(uuid) from public, anon;
grant execute on function public.can_access_pactset_go_bundle(uuid) to authenticated;

create policy pactset_go_runtime_read on public.pactset_go_runtime_registry for select to authenticated using (active);
create policy pactset_go_bundle_read on public.pactset_go_bundles for select to authenticated using (public.can_access_pactset_go_bundle(id));
create policy pactset_go_booking_read on public.pactset_go_bookings for select to authenticated using (public.can_access_pactset_go_bundle(bundle_id));
create policy pactset_go_transaction_read on public.pactset_go_transactions for select to authenticated using (public.can_access_pactset_go_bundle(bundle_id));

create or replace function public.register_pactset_go_bundle(
  p_bundle_id uuid, p_event_id uuid, p_organizer_id uuid, p_asset_id uuid, p_bundle_hash text,
  p_contract_version integer, p_activation_deadline timestamptz, p_total_amount bigint,
  p_agreement_ids uuid[], p_agreement_versions integer[], p_agreement_hashes text[],
  p_escrow_ids uuid[], p_escrow_addresses text[], p_provider_ids uuid[], p_provider_public_keys text[], p_amounts bigint[]
)
returns public.pactset_go_bundles language plpgsql security definer set search_path = '' as $$
declare v_bundle public.pactset_go_bundles; v_count integer; v_index integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  v_count := cardinality(p_agreement_ids);
  if v_count < 2 or v_count > 8 or v_count <> cardinality(p_agreement_versions) or v_count <> cardinality(p_agreement_hashes)
    or v_count <> cardinality(p_escrow_ids) or v_count <> cardinality(p_escrow_addresses) or v_count <> cardinality(p_provider_ids)
    or v_count <> cardinality(p_provider_public_keys) or v_count <> cardinality(p_amounts) then raise exception 'Invalid bundle booking arrays'; end if;
  insert into public.pactset_go_bundles(id,event_id,organizer_id,asset_id,bundle_hash,contract_version,activation_deadline,total_amount)
  values (p_bundle_id,p_event_id,p_organizer_id,p_asset_id,p_bundle_hash,p_contract_version,p_activation_deadline,p_total_amount)
  returning * into v_bundle;
  for v_index in 1..v_count loop
    insert into public.pactset_go_bookings(bundle_id,agreement_id,agreement_version,agreement_hash,escrow_id,escrow_contract_address,provider_id,provider_public_key,amount)
    values (v_bundle.id,p_agreement_ids[v_index],p_agreement_versions[v_index],p_agreement_hashes[v_index],p_escrow_ids[v_index],p_escrow_addresses[v_index],p_provider_ids[v_index],p_provider_public_keys[v_index],p_amounts[v_index]);
  end loop;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
  values (p_organizer_id,'pactset_go_bundle',v_bundle.id,'pactset_go_bundle_registered',jsonb_build_object('booking_count',v_count,'total_amount',p_total_amount,'asset_id',p_asset_id));
  return v_bundle;
end;
$$;
revoke all on function public.register_pactset_go_bundle(uuid,uuid,uuid,uuid,text,integer,timestamptz,bigint,uuid[],integer[],text[],uuid[],text[],uuid[],text[],bigint[]) from public, anon, authenticated;
grant execute on function public.register_pactset_go_bundle(uuid,uuid,uuid,uuid,text,integer,timestamptz,bigint,uuid[],integer[],text[],uuid[],text[],uuid[],text[],bigint[]) to service_role;

comment on table public.pactset_go_bundles is 'Projection of a Pactset Go Soroban bundle. Confirmed ledger state is authoritative.';
comment on table public.pactset_go_bookings is 'Exact agreement-version and escrow bindings; incompatible or funded legacy escrows cannot participate.';
