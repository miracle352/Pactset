# SECURITY DEFINER review

Reviewed 2026-10-05 against `pactset-development`. Every caller-facing definer below uses `search_path = ''`, derives the caller from `auth.uid()`, and has execution revoked from `public`/`anon`. `finalize_escrow_deployment` is separately restricted to `service_role`.

| Function | Justified definer use and caller authorization | Decision |
| --- | --- | --- |
| `can_resolve_agreement` | Breaks recursive RLS; requires an active support membership, assignment to an active case, and a verified wallet equal to the agreement's disclosed resolver | Keep as narrow RLS helper |
| `can_access_support_case` | Avoids recursive case/message/event policies; participants are checked against the agreement and assigned support must still have an active server-controlled membership | Keep as narrow RLS helper |
| `can_access_assigned_agreement` | Allows only the active support identity assigned to a case to read the related agreement projection; it grants no write or on-chain authority | Keep as narrow RLS helper |
| `open_support_case` | Authenticated caller must be an agreement participant; the function locks the agreement, reuses an active case, assigns only the support identity that owns the escrow's disclosed resolver, and writes an audit event | Keep as atomic assignment RPC |
| `add_support_case_message` | Caller must pass case-scoped access; any referenced evidence must belong to that case's agreement; message and audit event are inserted together | Keep as scoped write RPC |
| `finalize_escrow_deployment` | Not executable by browser roles; service role only. Locks the agreement, returns an existing escrow on retry, validates milestone allocation, and records the confirmed contract/hash atomically | Keep as ledger reconciliation RPC |
| `activate_wallet_connection` | Not executable by browser roles; service role only. It rejects a wallet owned by another account and transactionally selects one active verified wallet without changing any existing escrow participant | Keep as wallet-verification persistence RPC |
| `counter_offer` | Locks offer/version rows; caller must be organizer or provider participant and pass expected-version/state checks | Keep as atomic transition RPC |
| `has_active_provider_role` | Avoids recursive role-policy evaluation and exposes only a membership boolean | Keep; consider private-schema refactor later |
| `list_eligible_requests` | Produces a deliberately redacted request projection; caller must hold active supplier/crew role | Keep as discovery RPC |
| `publish_request` | Requires authenticated organizer membership, draft ownership and valid state | Keep as transition RPC |
| `respond_to_offer` | Enforces participant actor, row locks, stale-version, inventory-capacity and schedule-conflict rules | Keep as concurrency boundary |
| `submit_offer` | Requires matching provider role and validates visibility, currency, quantity, inventory ownership and idempotency | Keep as concurrency boundary |

Trigger-only definers `handle_new_user` and `rls_auto_enable` are not exposed to authenticated callers; execution is Postgres-only with constrained search paths. Multiple-permissive-policy notices reflect separate participant and assigned-case read paths, not broader write authority.

Reference: [Supabase linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
