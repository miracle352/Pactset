-- Pactset Stage 2B: Stellar Testnet wallet binding, asset registry, escrow reconciliation,
-- and private milestone evidence. No Mainnet values or secrets belong in these tables.

alter table public.profiles drop constraint if exists profiles_preferred_test_currency_check;
alter table public.profiles add constraint profiles_preferred_test_currency_check
  check (preferred_test_currency ~ '^T[A-Z]{3}$');
alter table public.events drop constraint if exists events_budget_currency_check;
alter table public.events add constraint events_budget_currency_check
  check (budget_currency ~ '^T[A-Z]{3}$');
alter table public.requests drop constraint if exists requests_currency_check;
alter table public.requests add constraint requests_currency_check
  check (currency ~ '^T[A-Z]{3}$');
alter table public.offer_versions drop constraint if exists offer_versions_currency_check;
alter table public.offer_versions add constraint offer_versions_currency_check
  check (currency ~ '^T[A-Z]{3}$');
alter table public.agreements drop constraint if exists agreements_currency_check;
alter table public.agreements add constraint agreements_currency_check
  check (currency ~ '^T[A-Z]{3}$');

create table public.test_asset_registry (
  id uuid primary key default gen_random_uuid(),
  currency_code text not null unique check (currency_code ~ '^[A-Z]{3}$'),
  currency_name text not null,
  asset_code text not null unique check (asset_code ~ '^T[A-Z]{3}$'),
  issuer_public_key text check (issuer_public_key is null or issuer_public_key ~ '^G[A-Z2-7]{55}$'),
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  decimals smallint not null default 7 check (decimals = 7),
  stellar_asset_contract text check (stellar_asset_contract is null or stellar_asset_contract ~ '^C[A-Z2-7]{55}$'),
  provisioning_status text not null default 'not_provisioned'
    check (provisioning_status in ('not_provisioned','provisioning','ready','failed')),
  liquidity_status text not null default 'unavailable'
    check (liquidity_status in ('unavailable','seeding','ready','failed')),
  illustrative_xlm_rate numeric(30,14) check (illustrative_xlm_rate is null or illustrative_xlm_rate > 0),
  provisioned_at timestamptz,
  updated_at timestamptz not null default now(),
  check (asset_code = 'T' || currency_code),
  check ((provisioning_status <> 'ready') or (issuer_public_key is not null and stellar_asset_contract is not null)),
  check ((liquidity_status <> 'ready') or (provisioning_status = 'ready' and illustrative_xlm_rate is not null))
);

create table public.wallet_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null check (public_key ~ '^G[A-Z2-7]{55}$'),
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  wallet_provider text not null check (char_length(wallet_provider) between 1 and 48),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, network),
  unique(public_key, network)
);

create table public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null check (public_key ~ '^G[A-Z2-7]{55}$'),
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  nonce_hash text not null unique,
  challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index wallet_challenges_user_idx on public.wallet_challenges(user_id, created_at desc);

create table public.payment_quotes (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  input_asset_type text not null default 'native' check (input_asset_type in ('native','credit_alphanum4','credit_alphanum12')),
  input_asset_code text,
  input_asset_issuer text,
  output_asset_id uuid not null references public.test_asset_registry(id),
  send_max_stroops bigint not null check (send_max_stroops > 0),
  destination_amount bigint not null check (destination_amount > 0),
  expected_send_amount bigint not null check (expected_send_amount > 0 and expected_send_amount <= send_max_stroops),
  fee_stroops bigint not null check (fee_stroops >= 0),
  slippage_bps integer not null check (slippage_bps between 0 and 1000),
  path jsonb not null default '[]'::jsonb,
  rate_source text not null default 'Pactset-seeded illustrative Testnet liquidity',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((input_asset_type = 'native' and input_asset_code is null and input_asset_issuer is null)
      or (input_asset_type <> 'native' and input_asset_code is not null and input_asset_issuer is not null))
);

create table public.agreement_escrows (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null unique references public.agreements(id) on delete restrict,
  agreement_version integer not null check (agreement_version > 0),
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  contract_address text not null unique check (contract_address ~ '^C[A-Z2-7]{55}$'),
  asset_id uuid not null references public.test_asset_registry(id),
  payer_public_key text not null check (payer_public_key ~ '^G[A-Z2-7]{55}$'),
  payee_public_key text not null check (payee_public_key ~ '^G[A-Z2-7]{55}$'),
  resolver_public_key text not null check (resolver_public_key ~ '^G[A-Z2-7]{55}$'),
  agreement_hash text not null check (agreement_hash ~ '^[0-9a-f]{64}$'),
  terms_hash text not null check (terms_hash ~ '^[0-9a-f]{64}$'),
  total_amount bigint not null check (total_amount > 0),
  status text not null default 'awaiting_funding'
    check (status in ('awaiting_funding','funding_pending','funded','partially_released','disputed','completed','partially_refunded','refunded','failed')),
  deployment_tx_hash text unique check (deployment_tx_hash is null or deployment_tx_hash ~ '^[0-9a-f]{64}$'),
  funding_tx_hash text unique check (funding_tx_hash is null or funding_tx_hash ~ '^[0-9a-f]{64}$'),
  funded_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.escrow_milestones (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.agreement_escrows(id) on delete restrict,
  milestone_index integer not null check (milestone_index >= 0),
  label text not null check (char_length(label) between 1 and 160),
  amount bigint not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','submitted','correction_requested','disputed','release_pending','released','refund_pending','refunded')),
  release_tx_hash text unique check (release_tx_hash is null or release_tx_hash ~ '^[0-9a-f]{64}$'),
  refund_tx_hash text unique check (refund_tx_hash is null or refund_tx_hash ~ '^[0-9a-f]{64}$'),
  submitted_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(escrow_id, milestone_index)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  escrow_id uuid references public.agreement_escrows(id) on delete restrict,
  milestone_id uuid references public.escrow_milestones(id) on delete restrict,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  kind text not null check (kind in ('conversion','contract_deploy','funding','release','refund','resolution')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 160),
  tx_hash text unique check (tx_hash is null or tx_hash ~ '^[0-9a-f]{64}$'),
  submitted_xdr text,
  status text not null default 'prepared' check (status in ('prepared','pending','confirmed','failed','expired')),
  ledger integer check (ledger is null or ledger > 0),
  error_code text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestone_evidence (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.escrow_milestones(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  note text not null check (char_length(note) between 1 and 4000),
  object_path text,
  media_type text check (media_type is null or media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 52428800),
  status text not null default 'submitted' check (status in ('submitted','correction_requested','approved')),
  organizer_feedback text check (organizer_feedback is null or char_length(organizer_feedback) <= 4000),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((object_path is null and media_type is null and size_bytes is null)
      or (object_path is not null and media_type is not null and size_bytes is not null))
);

alter table public.test_asset_registry enable row level security;
alter table public.wallet_connections enable row level security;
alter table public.wallet_challenges enable row level security;
alter table public.payment_quotes enable row level security;
alter table public.agreement_escrows enable row level security;
alter table public.escrow_milestones enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.milestone_evidence enable row level security;

create policy test_asset_registry_authenticated_read on public.test_asset_registry
  for select to authenticated using (true);
create policy wallet_connections_owner_read on public.wallet_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy payment_quotes_requester_read on public.payment_quotes
  for select to authenticated using (
    requested_by = (select auth.uid()) and exists (
      select 1 from public.agreements a where a.id = agreement_id and a.organizer_id = (select auth.uid())
    )
  );
create policy agreement_escrows_participant_read on public.agreement_escrows
  for select to authenticated using (exists (
    select 1 from public.agreements a
    where a.id = agreement_id and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
  ));
create policy escrow_milestones_participant_read on public.escrow_milestones
  for select to authenticated using (exists (
    select 1 from public.agreement_escrows e join public.agreements a on a.id = e.agreement_id
    where e.id = escrow_id and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
  ));
create policy payment_transactions_participant_read on public.payment_transactions
  for select to authenticated using (exists (
    select 1 from public.agreements a
    where a.id = agreement_id and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
  ));
create policy milestone_evidence_participant_read on public.milestone_evidence
  for select to authenticated using (exists (
    select 1
    from public.escrow_milestones m
    join public.agreement_escrows e on e.id = m.escrow_id
    join public.agreements a on a.id = e.agreement_id
    where m.id = milestone_id and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
  ));
create policy milestone_evidence_provider_insert on public.milestone_evidence
  for insert to authenticated with check (
    submitted_by = (select auth.uid()) and exists (
      select 1
      from public.escrow_milestones m
      join public.agreement_escrows e on e.id = m.escrow_id
      join public.agreements a on a.id = e.agreement_id
      where m.id = milestone_id and a.provider_id = (select auth.uid()) and m.status in ('pending','correction_requested')
    )
  );

revoke all on public.test_asset_registry, public.wallet_connections, public.wallet_challenges,
  public.payment_quotes, public.agreement_escrows, public.escrow_milestones,
  public.payment_transactions, public.milestone_evidence from anon, authenticated;
grant select on public.test_asset_registry, public.wallet_connections, public.payment_quotes,
  public.agreement_escrows, public.escrow_milestones, public.payment_transactions,
  public.milestone_evidence to authenticated;
grant insert on public.milestone_evidence to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-evidence',
  'milestone-evidence',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_objects_participant_read on storage.objects
  for select to authenticated using (
    bucket_id = 'milestone-evidence' and exists (
      select 1
      from public.milestone_evidence ev
      join public.escrow_milestones m on m.id = ev.milestone_id
      join public.agreement_escrows e on e.id = m.escrow_id
      join public.agreements a on a.id = e.agreement_id
      where ev.object_path = name and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
    )
  );
create policy evidence_objects_provider_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'milestone-evidence' and exists (
      select 1 from public.agreements a
      where a.provider_id = (select auth.uid()) and name like a.id::text || '/%'
    )
  );

insert into public.test_asset_registry (currency_code, currency_name, asset_code)
values
  ('USD', 'US Dollar', 'TUSD'),
  ('GBP', 'British Pound', 'TGBP'),
  ('AUD', 'Australian Dollar', 'TAUD'),
  ('NGN', 'Nigerian Naira', 'TNGN'),
  ('EUR', 'Euro', 'TEUR')
on conflict (currency_code) do nothing;

comment on table public.test_asset_registry is
  'Allowlisted Pactset-issued Stellar Testnet assets. Asset codes have no monetary value or affiliation with similarly named real tokens.';
comment on table public.wallet_challenges is
  'Server-only, expiring, single-use wallet ownership challenges. Never grant browser access.';
