# SECURITY DEFINER review

Reviewed 2026-10-05 against `pactset-development`. All seven advisor findings use `search_path = ''`, are executable by `authenticated` only, and derive the caller from `auth.uid()`.

| Function | Justified definer use and caller authorization | Decision |
| --- | --- | --- |
| `can_resolve_agreement` | Breaks recursive RLS; requires server-assigned support and a verified wallet equal to the agreement's disclosed resolver | Keep as narrow RLS helper |
| `counter_offer` | Locks offer/version rows; caller must be organizer or provider participant and pass expected-version/state checks | Keep as atomic transition RPC |
| `has_active_provider_role` | Avoids recursive role-policy evaluation and exposes only a membership boolean | Keep; consider private-schema refactor later |
| `list_eligible_requests` | Produces a deliberately redacted request projection; caller must hold active supplier/crew role | Keep as discovery RPC |
| `publish_request` | Requires authenticated organizer membership, draft ownership and valid state | Keep as transition RPC |
| `respond_to_offer` | Enforces participant actor, row locks, stale-version, inventory-capacity and schedule-conflict rules | Keep as concurrency boundary |
| `submit_offer` | Requires matching provider role and validates visibility, currency, quantity, inventory ownership and idempotency | Keep as concurrency boundary |

Trigger-only definers `handle_new_user` and `rls_auto_enable` are not exposed to authenticated callers; execution is Postgres-only with constrained search paths. The five multiple-permissive-policy notices are performance warnings from separate participant and disclosed-resolver read paths, not broader write authority.

Reference: [Supabase linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
