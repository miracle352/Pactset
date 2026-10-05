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
