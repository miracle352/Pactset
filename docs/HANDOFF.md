# Pactset Stage 2B handoff

Last updated: 2026-10-05 (Africa/Lagos)

## Safety boundary

- Use only Supabase `pactset-development` (`lvpsemqalftvcqkrjsyu`) and Stellar Testnet. Fieldwork and `supabase-canary-branch` were not changed.
- No website push or deployment was performed. The existing public Vercel site was not changed.
- `.env.local`, `.stage2a-test-state.local.json`, `.stellar-testnet.local.json`, and `.stellar-testnet-state.local.json` are ignored and must remain uncommitted. Never print their credentials or secret keys.
- Email confirmation and password-recovery email-link flows remain blocked/unverified. Verification was not disabled and no repeated rate-limited email attempts were made.

## Verified remote state before resume

- Applied migrations include `stage_2b_browser_payments` and `stage_2b_resolver_policy_fix`; do not apply them again.
- `wallet-auth` is active at version 1 and `stellar-payments` is active at version 5 with JWT verification enabled; do not redeploy unless its checked-in source changes.
- Fresh TUSD agreement `342466d3-c812-4dcb-ad12-9d9f373a70d4` is `completed` with one confirmed conversion, funding, submission and release.
- Fresh TEUR agreement `69cd95a1-9651-4484-bd26-b4e2ff61ace4` is `awaiting_funding` with one confirmed conversion. This is the intentional conversion-success/funding-retry checkpoint; do not convert again.

## Implemented browser payment path

- Account authentication remains separate from a verified Stellar Testnet wallet. `wallet-auth` uses an expiring, single-use signed challenge and rejects wrong network, replay, and wallet reuse.
- The authenticated `stellar-payments` function derives caller, role, wallet and agreement server-side. It prepares unsigned envelopes, verifies the returned envelope and signer, persists the hash before submission, and reconciles only the caller's pending transactions.
- Organizer controls cover exact-output XLM quote, trustline when required, Freighter signing, conversion, separate escrow funding, dispute, correction request, approval/release and reconciliation.
- Supplier/crew controls cover private note/photo/video evidence with progress and retry, on-chain submission, dispute and expiring private evidence links. Evidence does not require a wallet; money-moving actions do.
- Resolver controls require server-assigned support, the exact disclosed resolver wallet and a disputed milestone. AI has no payment authority.
- Idempotency keys and pending hashes survive refresh/retry. Prepared transactions expire after ten minutes. A confirmed conversion suppresses another quote and leaves funding independently retryable.
- The UI distinguishes planned, committed, funded, released, refunded and disputed amounts and links confirmed hashes to Stellar Expert Testnet.

## Genuine Testnet evidence

- Issuer: `GDPHFGDZMCRZT7STPWFS7ZP4ZRWE2JOGNCH6XCAUYIU2IT32RFWUPXQO`
- TUSD SAC: `CDH45Y72LSOSYCOCHU7WDA7UCFXJB2BXUB77AXULNBACC74VZBCJR43Q`
- TEUR SAC: `CBLM6Y2Y5L5TMPZL5URHG2GNX5DRZUN62OUX2IGGQDLFIUHETVGBZUTO`
- Fresh TUSD contract: `CDF6IVAJGRYF733QNLF5SSOHTDGZJCPCHAV6F3HC4CYEBELADTZKEKBZ`, 30 TUSD.
  - conversion `874a41a93f25ff45d83d666906df8d6bdb052aad920ce325a655c6dd63342596` (ledger 5028302)
  - funding `7a0d719f4e10c70b06e1c36a23773678a427d43835204a94a5e718a0b63408ba` (ledger 5028306)
  - submission `6f05a87fd5be596f9a10becee01793a97c99ba56d6932aff70875145dbd829dd` (ledger 5028308)
  - release `f95bc2af6ddde7a2d5628ea6af25d0ffbae1ea71f788be7b7f1b9a10020d18b9` (ledger 5028340)
  - supplier balance moved from 750 to exactly 780 TUSD.
- Fresh TEUR contract: `CDXY7TC665QUESWKOBP2IFQHC2BPMLWDGKL5Y4IDRK4VXJEC76Z4UDVQ`, 20 TEUR.
  - conversion `5c7cd360f178e9746179a48e296579a9fdc1f91e2238e5a33cdbff2cfeadcfb1` (ledger 5028304)
  - conversion is confirmed while funding is still retryable, proving the durable steps do not silently reconvert.
- These fresh journeys used isolated development fixture wallet keys through the same prepared-envelope API. They are automated Testnet proof, **not** Freighter extension/browser signing.

## Existing 750 TUSD explanation

The older contract `CAYZ36OCVMFANY7IIWA3PWJKQALKNY7GMMVL7G6LNROJQSZTZ4MZH74Y` was funded with 2,250 TUSD. Confirmed state is 750 released, 750 refunded, and milestone 3 still pending for 750. Thus 2,250 − 750 − 750 = 750 TUSD remains held by the contract; it is not a database-only balance.

## Verification completed

- Contract tests: 5 passed.
- App tests: 7 passed; typecheck and lint passed.
- `npx next build --webpack`: passed. Turbopack alone hit a OneDrive `EPERM` creating `_not-found.segments`.
- API boundary test passed quote/preparation and rejected supplier release, unrelated access and unsigned submission.
- Reconciliation worker passed for organizer, supplier, crew and unrelated identities; no pending transactions remained.
- Browser test passed serially on desktop and Pixel 7 mobile with separate organizer/supplier/unrelated contexts, both themes, persistence, Explorer links and recovered TEUR funding UI.
- Screenshots were visually inspected: `docs/screenshots/stage-2b-{light,dark}-{desktop,mobile}.png`.
- Live prior controls rejected repeated, unauthorized and disputed ordinary release; resolver refund confirmed. Contract tests cover agreement isolation.

## Honest remaining blockers

- Freighter extension signing needs the user's private browser interaction. No operator key was substituted for that claim. The UI/server path is implemented; extension confirmation remains for restricted staging.
- Missing trustline is implemented, but fresh wallets already had trustlines. Insufficient XLM/reserve and unavailable-liquidity errors are implemented but not destructively forced. Quote expiry is enforced server-side but was not held open for a two-minute browser test.
- No deliberately failing signed funding transaction was broadcast. The confirmed TEUR conversion with an unfunded escrow proves recovery state, not an actual failed ledger transaction.
- A second crew Auth identity and support Auth identity are not present. The organizer/supplier/two-crew/support rehearsal remains for restricted staging; do not duplicate existing accounts.
- The advisor reports seven authenticated `SECURITY DEFINER` functions because the resolver fix added `can_resolve_agreement`. Review is in `docs/security-definer-review.md`.

## Developer commands

```powershell
npm install
npm run dev
npm run payments:reconcile
npm run payments:verify-api
npm run typecheck
npm run lint
npm test
npx next build --webpack
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path contracts/Cargo.toml
```

Do not rerun `payments:deploy-fixtures` or `payments:verify-fresh` against the recorded agreements. The future tester is not required to install locally; use `docs/staging-test-plan.md`.

## Next exact step

After explicit staging authorization, create only the missing second-crew and support identities, bind distinct Testnet wallets, publish a protected preview (not a custom production domain), configure exact Supabase redirects, and perform the Freighter rehearsal in separate browser profiles. Later translated chat, AI budgeting, cancellation/replacement, reputation, readiness, discovery, avatars and interactive 3D remain required.

## 2026-10-05 continuation checkpoint

- Crew B and support were created through the `pactset-development` Auth dashboard only after a duplicate check. Their actual strong credentials and UUIDs are stored only in ignored `.stage2a-test-state.local.json`. `crew` and `support` memberships were assigned through the authorized database administration connection and recorded in `audit_events`; `raw_user_meta_data` contains no role or privilege claim. Dashboard inspection confirms global **Confirm email** remains enabled. Fixture auto-confirm did not exercise the real email flow.
- `npm run payments:verify-failures` passed against resumable disposable Testnet fixtures stored in ignored `.stellar-failure-fixtures.local.json`: missing TUSD trustline → `tx_failed/op_no_trust`; retained 1.1000200 XLM then TUSD trustline → `tx_failed/op_low_reserve`; unprovisioned `TNOQ` → zero offers and zero strict-receive paths. The reserve setup transaction is `5239d6061e0e63c95167cf03c739cb67c8252b30dacee1f08877c1e6c0def62f` at ledger `5033100`. Existing agreements were not referenced or modified.
- Vercel dashboard verification: exact project `pactset`, ID `prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`, `miracle352` Hobby scope; Require Log In/Standard Protection checked; password protection disabled/paid; protected sourcemaps checked; no environment variables exist. The connector still returns `403 Not authorized` for the `miracle352` scope and requires separate re-authorization. Nothing was deployed or pushed.
- Supabase Auth URL configuration still uses Site URL `http://localhost:3000` and only `http://localhost:3000/**`. Add the exact protected Preview callback paths only immediately before an authorized staging review.
- Staging protection is layered: Vercel Authentication covers the Preview's pages and same-origin APIs; external Supabase Edge/Storage endpoints remain protected by JWT, server-derived membership/RLS, private bucket rules and 60-second evidence URLs. Preview reconciliation is caller-scoped on submit/refresh/manual action, with `npm run payments:reconcile` as the developer fallback; do not use a Hobby Production cron for Preview.
- Email confirmation and password-recovery links remain unverified; fixture auto-confirm is not proof of those flows.

## Identity and authorization verification

- `npm run accounts:verify-development` passed 24/24 checks through the actual publishable client/RLS boundary. Organizer, supplier, Crew A, Crew B, support and unrelated are six distinct Auth identities; each sees exactly its own role row, and Crew B's attempt to self-assign support was rejected by database policy.
- Organizer and supplier could read their shared private agreement, Crew A could read its own agreement, while Crew B and the unrelated account could not read that agreement or any private milestone evidence.
- The new support identity has no resolver wallet and could read zero private agreements, evidence records or disputed milestones.
- **Assigned-case support workflow is not implemented.** There is no support-case/assignment table or assigned-case UI/data flow. Current payment policies expose related records only when an active server-assigned support identity also owns the agreement's exact disclosed resolver wallet. That resolver-wallet boundary is narrow, but it is not proof of assigned-case access. Do not bind the new support identity to a resolver wallet or claim a case-access test until the later audited assignment workflow exists.
- Normal confirmation-email and password-recovery email-link flows remain unverified and must stay blocked in status until real received links pass.
