# Pactset Stage 2B handoff

Last updated: 2026-10-05 (Africa/Lagos)

## Safety and scope

- Work only in Supabase `pactset-development` (`lvpsemqalftvcqkrjsyu`) in “miracle352’s projects” and Stellar **Testnet**. Fieldwork and `supabase-canary-branch` remain untouched.
- No push, Vercel deployment, Mainnet transaction, paid service, real fund, or public website change was performed.
- `.env.local`, `.stage2a-test-state.local.json`, `.stellar-testnet.local.json`, and `.stellar-testnet-state.local.json` are ignored. The first three contain development credentials and must never be printed or committed. The fourth contains only public Testnet evidence but remains local to keep the repository clean.
- Email confirmation and password-recovery email links remain blocked/unverified by the Free-plan email limit. Verification was not disabled.

## Applied development state

- Stage 2A migrations and remote verification remain intact.
- Applied Stage 2B migrations:
  - `stage_2b_payments`
  - `stage_2b_security_indexes`
  - `stage_2b_service_grants`
  - `stage_2b_ledger_actors`
- Deployed authenticated `wallet-auth` Edge Function. Its expiring, single-use signing challenge passed wrong-network, replay, and cross-account wallet reuse rejection with separate organizer/supplier identities.
- Private `milestone-evidence` bucket allows only JPEG/PNG/WebP/MP4/WebM up to 50 MB. A real supplier upload produced an organizer-only 60-second signed link; the unrelated account could read neither object nor metadata.

## Genuine Stellar Testnet evidence

- Issuer: `GDPHFGDZMCRZT7STPWFS7ZP4ZRWE2JOGNCH6XCAUYIU2IT32RFWUPXQO`
- TUSD SAC: `CDH45Y72LSOSYCOCHU7WDA7UCFXJB2BXUB77AXULNBACC74VZBCJR43Q`; illustrative seeded rate 0.5 XLM per TUSD.
- TEUR SAC: `CBLM6Y2Y5L5TMPZL5URHG2GNX5DRZUN62OUX2IGGQDLFIUHETVGBZUTO`; illustrative seeded rate 0.6 XLM per TEUR.
- Escrow contract: `CAYZ36OCVMFANY7IIWA3PWJKQALKNY7GMMVL7G6LNROJQSZTZ4MZH74Y` for agreement `e6625251-d065-4879-add7-8ea679ec1e62`, accepted version 2, 2,250 TUSD total.
- Conversion: `45d73a21a7f9d8ec2de08122aec4e54765cd8bb7e6b03edd44839ced74a1f74c` — exact 2,250 TUSD received for expected 1,125 XLM, 1,130.625 XLM maximum, 50 bps slippage, 100 stroop fee.
- Funding: `bca785bd244bd6dd074bdd157906f357893a35f1ac0c20adae127e4dcf6c3726`.
- Milestone submission: `86a9634224c978f05534d53b906a5374750cd84226c275b5c3a30a7058a2b844`.
- Release: `a6484c534f35ad9a3ce9bfa63bd585bfe2528e29e1287ff2cb47bd91380e3ae4`; supplier balance increased from 0 to exactly 750 TUSD.
- Live controls: repeated release, supplier unauthorized release, and organizer release while disputed were rejected. Milestone 1 submission `54000a613f70bb373dcd55a7ebc5de6d06b1ff1c2c0bdcaf5d078e22c046e321`, dispute `f0d429d86e388940de4748fd7371d6c6129a8eb91a55477b9f7bb7abada88a30`, resolver refund `fa689f013709d2345f4778599d147860d7ed1f9204e03aa75edd7c55156b0932`.
- Final on-chain milestone states: released 750 TUSD, refunded 750 TUSD, pending 750 TUSD.

## Verified checks

- `cargo test --manifest-path contracts/Cargo.toml`: 5 passed (exact single release, dispute/refund, mutual refund, unrelated actor rejection, agreement isolation).
- `node scripts/stellar/verify-wallet-auth.mjs`: all 5 wallet boundary checks passed.
- `node scripts/stellar/verify-private-evidence.mjs`: upload/participant signed URL/unrelated denial passed.
- `node scripts/stellar/verify-escrow-controls.mjs`: all live rejection and resolver checks passed.
- `npm run typecheck`, `npm run lint`, and `npm run build`: passed on the final files.
- `npm test`: 7 passed, 0 failed.
- `tests/e2e/stage2b-payments.spec.ts`: 2 passed against the production build with separate organizer, supplier, and unrelated contexts; theme persistence, transaction links, private evidence projection, no horizontal overflow, and unrelated denial passed.
- Screenshots: `docs/screenshots/stage-2b-{light,dark}-{desktop,mobile}.png`, visually inspected.
- Supabase advisors: no new Stage 2B RLS/grant warnings. Six intentional Stage 2A authenticated `SECURITY DEFINER` RPC warnings remain under prior review; leaked-password protection remains disabled; three older Stage 2A foreign-key index notices and expected unused-new-index notices remain.

## Honest incomplete work

- The real payment journey is currently operator-driven through ignored local Testnet scripts. The browser can verify wallet ownership and display reconciled ledger truth, but quote/conversion/funding/evidence/approval/release buttons are not yet wallet-signed end-to-end; incomplete actions are disabled and labeled.
- Missing-trustline, insufficient reserve/funds, unavailable-liquidity, expired-quote, rejected transaction-signature, conversion-success/funding-failure recovery, delayed confirmation, and automatic reconciliation-worker checks remain.
- TEUR was provisioned and liquidity seeded by the same generic process, but no second end-user conversion was executed.
- Browser evidence upload/progress/retry/correction UI, dispute initiation UI, and resolver case UI remain incomplete.
- Contract deployment transaction hash was not captured; the verified contract address and all journey/action hashes are recorded.

## Exact next steps

1. Implement server-built wallet transaction envelopes and Freighter signing for quote/conversion/funding without exposing secrets; persist pending identifiers before submission and reconcile from ledger confirmation.
2. Add authenticated evidence upload/review/correction controls, then organizer release and dispute actions using the same on-chain contract.
3. Execute the outstanding failure matrix and a second-currency user conversion.
4. Address the three older foreign-key index notices in a separate reviewed migration; do not remove new “unused” indexes merely because this small development dataset has not exercised them.
5. Before any future publication, rerun all checks and inspect the local commit. Do not push or deploy without new authorization.

## Preserved later scope

Translated chat, AI-assisted budgeting, assigned support workspace, cancellation review, contingency-funded replacements, ratings/activity history, readiness deadlines, radar/list discovery, avatars, and the complete interactive 3D landing behavior remain required and are not complete.
