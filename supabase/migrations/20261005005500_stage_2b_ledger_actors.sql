-- Resolver actions may be signed by a disclosed Testnet wallet that is not a
-- Pactset login. Preserve the ledger signer without attributing it to a user.

alter table public.payment_transactions alter column initiated_by drop not null;
alter table public.payment_transactions add column actor_public_key text
  check (actor_public_key is null or actor_public_key ~ '^G[A-Z2-7]{55}$');
alter table public.payment_transactions add constraint payment_transactions_actor_check
  check (initiated_by is not null or actor_public_key is not null);
