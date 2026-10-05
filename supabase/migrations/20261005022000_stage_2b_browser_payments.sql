-- Browser-authorized Stage 2B transaction lifecycle. The service role is used
-- only by the authenticated stellar-payments Edge Function; browsers retain
-- read-only access to payment records through participant RLS policies.

alter table public.payment_transactions
  drop constraint payment_transactions_kind_check;

alter table public.payment_transactions
  add constraint payment_transactions_kind_check check (kind in (
    'trustline', 'conversion', 'contract_deploy', 'funding', 'submission',
    'correction', 'release', 'dispute', 'refund', 'resolution'
  )),
  add column quote_id uuid references public.payment_quotes(id) on delete restrict,
  add column action_name text check (action_name is null or action_name in (
    'change_trust', 'convert', 'fund', 'submit', 'request_correction',
    'approve_release', 'dispute', 'resolve'
  )),
  add column milestone_index integer check (milestone_index is null or milestone_index >= 0),
  add column resolution text check (resolution is null or resolution in ('release', 'refund')),
  add column action_metadata jsonb not null default '{}'::jsonb,
  add column prepared_at timestamptz,
  add column submitted_at timestamptz;

create index payment_transactions_pending_idx
  on public.payment_transactions(status, created_at)
  where status in ('prepared', 'pending');
create index payment_transactions_quote_id_idx on public.payment_transactions(quote_id);

grant select, insert, update on public.payment_quotes, public.payment_transactions,
  public.agreement_escrows, public.escrow_milestones, public.milestone_evidence,
  public.test_asset_registry to service_role;
grant select on public.agreements, public.account_roles to service_role;
grant select, insert, update, delete on storage.objects to service_role;

-- A server-assigned support member can see only an agreement whose disclosed
-- resolver wallet they have independently verified. This does not grant the
-- public support role or general agreement access.
create policy agreements_disclosed_resolver_support_read on public.agreements
  for select to authenticated using (exists (
    select 1
    from public.agreement_escrows e
    join public.wallet_connections w on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    where e.agreement_id = agreements.id
      and w.user_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
  ));
create policy agreement_escrows_disclosed_resolver_support_read on public.agreement_escrows
  for select to authenticated using (exists (
    select 1 from public.wallet_connections w
    join public.account_roles ar on ar.user_id = w.user_id
    where w.user_id = (select auth.uid()) and w.network = agreement_escrows.network
      and w.public_key = agreement_escrows.resolver_public_key
      and ar.role = 'support' and ar.status = 'active'
  ));
create policy escrow_milestones_disclosed_resolver_support_read on public.escrow_milestones
  for select to authenticated using (exists (
    select 1 from public.agreement_escrows e
    join public.wallet_connections w on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    where e.id = escrow_milestones.escrow_id and w.user_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
  ));
create policy payment_transactions_disclosed_resolver_support_read on public.payment_transactions
  for select to authenticated using (exists (
    select 1 from public.agreement_escrows e
    join public.wallet_connections w on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    where e.id = payment_transactions.escrow_id and w.user_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
  ));
create policy milestone_evidence_disclosed_resolver_support_read on public.milestone_evidence
  for select to authenticated using (exists (
    select 1 from public.escrow_milestones m
    join public.agreement_escrows e on e.id = m.escrow_id
    join public.wallet_connections w on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    where m.id = milestone_evidence.milestone_id and w.user_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
  ));

comment on column public.payment_transactions.submitted_xdr is
  'Unsigned prepared envelope until submission, then the exact signed envelope submitted to Testnet. Never contains a private key.';
comment on column public.payment_transactions.action_metadata is
  'Server-validated non-secret action details used for ledger reconciliation.';
