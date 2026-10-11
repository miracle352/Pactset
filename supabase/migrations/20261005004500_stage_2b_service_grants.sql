-- Stage 2B server boundary grants.
-- The project intentionally disables automatic table exposure, so the Edge
-- Function's service role receives only the operations used by wallet auth.

grant select, insert, update on public.wallet_challenges to service_role;
grant select, insert, update on public.wallet_connections to service_role;
