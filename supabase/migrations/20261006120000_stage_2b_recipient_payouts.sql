-- Recipient-authorized post-release conversion and an explicitly simulated
-- local-currency withdrawal rehearsal. No issuer or wallet secrets are stored.

alter table public.payment_transactions drop constraint if exists payment_transactions_kind_check;
alter table public.payment_transactions add constraint payment_transactions_kind_check check (kind in (
  'trustline','conversion','recipient_conversion','contract_deploy','funding','submission',
  'correction','release','dispute','refund','resolution'
));

alter table public.payment_transactions drop constraint if exists payment_transactions_action_name_check;
alter table public.payment_transactions add constraint payment_transactions_action_name_check check (action_name is null or action_name in (
  'create_escrow','change_trust','convert','recipient_change_trust','recipient_convert',
  'fund','submit','request_correction','approve_release','dispute','resolve'
));

create table public.recipient_conversion_quotes (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  network text not null default 'TESTNET' check (network = 'TESTNET'),
  input_asset_id uuid not null references public.test_asset_registry(id) on delete restrict,
  output_asset_id uuid references public.test_asset_registry(id) on delete restrict,
  output_is_native boolean not null default false,
  input_amount bigint not null check (input_amount > 0),
  expected_output_amount bigint not null check (expected_output_amount > 0),
  minimum_output_amount bigint not null check (minimum_output_amount > 0),
  fee_stroops bigint not null check (fee_stroops > 0),
  slippage_bps integer not null check (slippage_bps between 0 and 1000),
  path jsonb not null default '[]'::jsonb,
  rate_source text not null default 'Pactset-seeded illustrative Testnet liquidity',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (output_is_native <> (output_asset_id is not null))
);

alter table public.payment_transactions
  add column recipient_quote_id uuid references public.recipient_conversion_quotes(id) on delete restrict;

create table public.sandbox_withdrawals (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  asset_id uuid not null references public.test_asset_registry(id) on delete restrict,
  amount bigint not null check (amount > 0),
  destination_label text not null check (char_length(destination_label) between 3 and 120),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 160),
  status text not null default 'simulated_ready' check (status in ('simulated_ready','cancelled')),
  disclosure text not null default 'Simulation only. No bank, anchor, or real-world payout was contacted.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipient_conversion_quotes enable row level security;
alter table public.sandbox_withdrawals enable row level security;

revoke all on public.recipient_conversion_quotes, public.sandbox_withdrawals from public, anon, authenticated;
grant select on public.recipient_conversion_quotes, public.sandbox_withdrawals to authenticated;
grant select, insert, update on public.recipient_conversion_quotes, public.sandbox_withdrawals to service_role;

create policy recipient_conversion_quotes_owner_read on public.recipient_conversion_quotes
  for select to authenticated using (
    requested_by = (select auth.uid()) and exists (
      select 1 from public.agreements a
      where a.id = agreement_id and a.provider_id = (select auth.uid())
    )
  );

create policy sandbox_withdrawals_owner_read on public.sandbox_withdrawals
  for select to authenticated using (
    requested_by = (select auth.uid()) and exists (
      select 1 from public.agreements a
      where a.id = agreement_id and a.provider_id = (select auth.uid())
    )
  );

create index recipient_conversion_quotes_agreement_idx
  on public.recipient_conversion_quotes(agreement_id, requested_by, created_at desc);
create index sandbox_withdrawals_agreement_idx
  on public.sandbox_withdrawals(agreement_id, requested_by, created_at desc);

comment on table public.recipient_conversion_quotes is 'Expiring provider-authorized quotes for converting released Testnet earnings after escrow payout.';
comment on table public.sandbox_withdrawals is 'Honest non-bank rehearsal records. These rows never prove or trigger a real-world withdrawal.';
