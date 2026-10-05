-- Make the server-only challenge boundary explicit and index payment joins used by RLS/reconciliation.

create policy wallet_challenges_explicit_client_deny on public.wallet_challenges
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

create index agreement_escrows_asset_id_idx on public.agreement_escrows(asset_id);
create index escrow_milestones_escrow_id_idx on public.escrow_milestones(escrow_id);
create index milestone_evidence_milestone_id_idx on public.milestone_evidence(milestone_id);
create index milestone_evidence_submitted_by_idx on public.milestone_evidence(submitted_by);
create index milestone_evidence_reviewed_by_idx on public.milestone_evidence(reviewed_by) where reviewed_by is not null;
create index payment_quotes_agreement_id_idx on public.payment_quotes(agreement_id);
create index payment_quotes_output_asset_id_idx on public.payment_quotes(output_asset_id);
create index payment_quotes_requested_by_idx on public.payment_quotes(requested_by);
create index payment_transactions_agreement_id_idx on public.payment_transactions(agreement_id);
create index payment_transactions_escrow_id_idx on public.payment_transactions(escrow_id) where escrow_id is not null;
create index payment_transactions_milestone_id_idx on public.payment_transactions(milestone_id) where milestone_id is not null;
create index payment_transactions_initiated_by_idx on public.payment_transactions(initiated_by);
