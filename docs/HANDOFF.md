# Pactset Stage 2B handoff

Last updated: 2026-10-05 (Africa/Lagos)

## Safety boundary

- Use only Supabase `pactset-development` (`lvpsemqalftvcqkrjsyu`) and Stellar Testnet. Fieldwork and `supabase-canary-branch` were not changed.
- A secret-free backup was pushed only to `codex/stage-2b-preview`, and a Standard-Protected Vercel **Preview** was created. `main`, the Production deployment, custom domains, and the public site were not changed.
- `.env.local`, `.stage2a-test-state.local.json`, `.stellar-testnet.local.json`, and `.stellar-testnet-state.local.json` are ignored and must remain uncommitted. Never print their credentials or secret keys.
- Email confirmation and password-recovery email-link flows remain blocked/unverified. Verification was not disabled and no repeated rate-limited email attempts were made.

## Verified remote state before resume

- Applied migrations also include `stage_2b_user_escrow_and_assigned_support` and `stage_2b_development_runtime`; do not apply them again. The development-runtime row contains public Testnet identifiers only.
- `wallet-auth` is active at version 1 and `stellar-payments` is active at version 8 with JWT verification enabled; do not redeploy unless its checked-in source changes.
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
- Crew B and support Auth identities now exist and passed the role/RLS checks documented below. The organizer/supplier/two-crew/support browser rehearsal remains; do not duplicate those accounts.
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

Push this secret-free checkpoint only to `codex/stage-2b-preview`, wait for the Standard-Protected Preview rebuild, and verify the deployed wallet-created escrow and assigned-case UI. Then perform the real Freighter rehearsal in separate browser profiles against fresh agreement `b6346e29-c5ba-488c-aade-8e454df973d6`. Do not bind fixture wallets to that agreement. Later translated chat, AI budgeting, cancellation/replacement, reputation, readiness, discovery, avatars and interactive 3D remain required.

## 2026-10-05 continuation checkpoint

- Crew B and support were created through the `pactset-development` Auth dashboard only after a duplicate check. Their actual strong credentials and UUIDs are stored only in ignored `.stage2a-test-state.local.json`. `crew` and `support` memberships were assigned through the authorized database administration connection and recorded in `audit_events`; `raw_user_meta_data` contains no role or privilege claim. Dashboard inspection confirms global **Confirm email** remains enabled. Fixture auto-confirm did not exercise the real email flow.
- `npm run payments:verify-failures` passed against resumable disposable Testnet fixtures stored in ignored `.stellar-failure-fixtures.local.json`: missing TUSD trustline → `tx_failed/op_no_trust`; retained 1.1000200 XLM then TUSD trustline → `tx_failed/op_low_reserve`; unprovisioned `TNOQ` → zero offers and zero strict-receive paths. The reserve setup transaction is `5239d6061e0e63c95167cf03c739cb67c8252b30dacee1f08877c1e6c0def62f` at ledger `5033100`. Existing agreements were not referenced or modified.
- Before staging, the Vercel dashboard showed exact project `pactset`, ID `prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`, `miracle352` Hobby scope; Require Log In/Standard Protection checked; password protection disabled/paid; protected sourcemaps checked; and no environment variables. The later restricted-Preview section below supersedes the no-deployment/no-variable state. The connector still returns `403 Not authorized`; the independently authenticated browser was used.
- Supabase Auth URL configuration now uses the exact protected Preview Site URL plus exact confirmation/recovery route entries. `http://localhost:3000/**` remains available for developers; no broad Preview wildcard was added.
- Staging protection is layered: Vercel Authentication covers the Preview's pages and same-origin APIs; external Supabase Edge/Storage endpoints remain protected by JWT, server-derived membership/RLS, private bucket rules and 60-second evidence URLs. Preview reconciliation is caller-scoped on submit/refresh/manual action, with `npm run payments:reconcile` as the developer fallback; do not use a Hobby Production cron for Preview.
- Email confirmation and password-recovery links remain unverified; fixture auto-confirm is not proof of those flows.

## Identity and authorization verification

- `npm run accounts:verify-development` passed 24/24 checks through the actual publishable client/RLS boundary. Organizer, supplier, Crew A, Crew B, support and unrelated are six distinct Auth identities; each sees exactly its own role row, and Crew B's attempt to self-assign support was rejected by database policy.
- Organizer and supplier could read their shared private agreement, Crew A could read its own agreement, while Crew B and the unrelated account could not read that agreement or any private milestone evidence.
- The new support identity has no resolver wallet and could read zero private agreements, evidence records or disputed milestones.
- Assigned-case support is now implemented at its Stage 2B core: participants open cases, assignment is server-controlled to active support owning the disclosed resolver, RLS scopes related records to that case, messages/events are audited, and on-chain resolution still requires the exact resolver wallet plus a reason. The fixture resolver ownership test passed; a real Freighter dispute/resolution browser rehearsal remains.
- Normal confirmation-email and password-recovery email-link flows remain unverified and must stay blocked in status until real received links pass.

## 2026-10-05 restricted Preview checkpoint

- GitHub backup branch: `codex/stage-2b-preview` in `miracle352/Pactset`. The original six local commits through `413bcd7d415ffc314c128ff2a1ef894ed30cc969` were scanned and pushed without changing `main`, repository visibility, or Production.
- Vercel target: existing project `pactset` (`prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`) in the `miracle352` Hobby scope. Standard Vercel Authentication remains enabled. Deployment `dpl_2oUWebpMY1JN6QBSVSnBWSUz7PeX` is a Ready **Preview**, never Production, at `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app`.
- Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` are configured, scoped to `codex/stage-2b-preview`. Source inspection showed these are the only deploy-time variables read by the Next.js app. No issuer, liquidity, wallet, test-account, seed, service-role, or operator credential was added to Vercel.
- Unauthenticated requests to `/` and `/auth/sign-in` returned a Vercel SSO `302` with `no-store` and `noindex`; a Vercel-authenticated owner opened the real landing and Pactset sign-in pages. There are no same-origin application APIs except `/auth/confirm`. Direct unauthenticated `wallet-auth` and `stellar-payments` requests returned `401`. A public-key-only evidence bucket listing returned no rows; the authenticated evidence verification reused the existing fixture, issued a 60-second organizer URL, denied the unrelated account a URL, and exposed zero unrelated metadata rows.
- The deployed landing and sign-in screens were visually inspected in light and dark desktop themes; theme persisted across navigation and no application console errors were observed. The only warnings were from the Freighter extension content script. The browser viewport override did not change the attached Chrome window, so deployed narrow-mobile visual inspection still requires the owner's authenticated browser; unchanged local Pixel/mobile checks remain recorded above.
- Fresh real accepted agreement `b6346e29-c5ba-488c-aade-8e454df973d6` is `awaiting_testnet_funding` for 5 TUSD between the existing organizer and supplier identities. It has no escrow contract and no operator wallet. `.staging-preview-state.local.json` records only its resumable IDs and is ignored. After both people verify distinct Freighter Testnet wallets, a developer must deploy/reconcile an agreement-bound escrow using those public keys before quote/fund controls can work. Never bind the automated fixture wallets to this agreement.
- Supabase Auth Site URL and redirects are saved: exact branch Preview Site URL, exact `/auth/confirm**` and `/auth/update-password` routes, plus retained `http://localhost:3000/**`. Real confirmation-email and password-recovery links remain unverified; confirmation stays enabled.
- Current checks after staging preparation: typecheck passed, Biome lint passed (80 files), 7/7 app tests passed, and `npx next build --webpack` passed. The protected Preview rebuild itself completed Ready in 56 seconds.
- Credentials remain only in ignored `.stage2a-test-state.local.json`. The owner can open that local file privately in Codex/a local editor; never paste it into chat, Git, Vercel, a share link, or a test report.
- Reconciliation on Preview occurs after submission, on refresh/manual authenticated action, and via the developer command `npm run payments:reconcile`. There is no unattended background reconciliation while nobody visits because no Preview scheduler is running.
- The support identity now owns the disclosed development resolver through a fixture-signed, single-use wallet challenge. Assigned-case access is implemented without broad support reads. This does not prove the owner's Freighter extension; use a fresh disputed agreement for the browser resolver rehearsal.

## 2026-10-05 wallet-created escrow continuation

- Contract WASM hash: `16bbec4ac902d7ad0256ea75404df8c7f45f5e4dd3cd0fab8f7fa9a0cd12d635` on Stellar Testnet. The application derives a deterministic contract address from the organizer and agreement-version salt, prepares the custom-contract transaction server-side, and requires the organizer's verified wallet signature.
- Interrupted reconciliation recovered confirmed deployment `749626ab9ad223acff6716c17ca0e88dbc61ec9bc4df507a31f6acac79168b4f` to contract `CC4WVKCENGZGVZQMBYPC26IKF6CNJOFN45HW7UMOA26WOCIPDZHM4D4P`. A retry returned the same agreement escrow and did not create another.
- Isolated automated agreement `60a7b51a-1129-45fe-8872-8f842ccd72ae` and assigned case `acdb42fc-4400-4faf-9efc-c70e6f357d33` verify the application/Edge/RLS path. `browserWalletSigning` is false and `fixtureSigningOnly` is true; real Freighter extension signing remains the owner's private step.
- The public currency catalogue remains independent from provisioned assets. Event planning accepts the searchable ISO catalogue; settlement controls still require an exact registered/provisioned asset and never substitute TUSD.
- Checks passed: typecheck, Biome lint, 8/8 app tests, 5/5 Rust contract tests, production build, and the resumable wallet-created-escrow integration. Email confirmation and recovery remain unverified until real received links complete both routes.
