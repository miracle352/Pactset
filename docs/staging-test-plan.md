# Restricted staging review plan

## Planning, reviews, and reminder operations (2026-10-11)

The hosted development schema now contains versioned budgets, completed-booking reviews, and durable reminder jobs. These migrations were applied only to `pactset-development`:

- `20261011190000_planning_reviews_reminders.sql`
- `20261011191500_reminder_schedule_coverage.sql`
- `20261011193000_planning_review_reminder_indexes.sql`

Developer verification uses ignored local credentials:

```powershell
npm run planning:verify-development
npm run reminders:process
```

`reminders:process` requires the server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. It refreshes eligible jobs and delivers due jobs to the existing private in-app notification table. It is not a continuously running scheduler, email sender, or push service; staging has no background delivery while this command (or an equivalent protected worker) is not running.

For private review, sign in as the organizer, open an event and use **Event budget** to save then approve a planning version. Approval must leave offers, agreements, wallets, and funds unchanged. After a genuinely completed booking, either participant can use **Verified booking feedback** on its payment page. Supplier and crew workspaces show only feedback they are authorized to read.

## 2026-10-11 local backend checkpoint

This checkpoint remains local and must not be expected on the protected Preview. The new hosted-database migration is `20261011120000_capacity_buffers_and_replacement_controls.sql`, applied only to `pactset-development`; no website deployment followed it.

Developer checks (credentials remain in ignored local files):

```powershell
node scripts/admin/verify-capacity-concurrency.mjs
node scripts/admin/verify-replacement-support-deadlines.mjs
node scripts/qa/capture-backend-milestone.mjs
npm run payments:verify-api
npm run payments:verify-failures
cd contracts
cargo test --workspace
```

The production build is deliberately omitted while the owner defers the known OneDrive filesystem blocker. `npm test`, `npm run typecheck`, and `npm run lint` remain required and pass at this checkpoint.

### Manual email confirmation and reset

1. Run the local app at `http://localhost:3000` in the same browser that will open the email link; confirm that localhost remains an allowed Supabase Auth redirect.
2. Create a fresh address through the public role-specific signup page. Do not use an admin-confirmed fixture as proof. Confirm the generic response does not reveal whether an address already exists.
3. Open the confirmation email once. Expect `/auth/confirm` on the same origin, a Pactset session, and the intended safe workspace/onboarding destination. Reopening the consumed link must show a clear invalid/used state.
4. Sign out and confirm a private workspace deep link returns to sign-in with its internal destination preserved.
5. From Forgot password, request one reset email. Open it in the same browser/origin, expect `/auth/update-password`, set a new password, then prove the old password fails and the new password succeeds.
6. Separately inspect an expired or malformed link. It must return recovery-specific guidance and a safe return to sign-in without exposing account existence. Stop rather than repeatedly resend if Supabase reports a rate limit.

Real mailbox delivery/link completion is still unverified until the owner performs these steps. Wallet connection is not required for any of them.

### Remaining Freighter and Pactset Go rehearsal

Use separate browser profiles and distinct disposable Testnet wallets. Organizer and provider each verify ownership; organizer creates escrow, reviews an exact-receive TUSD or TEUR quote, signs conversion, then funds without reconverting after any funding retry. Provider submits private evidence; organizer requests one correction, approves, and releases. Record only public Testnet hashes. Repeat Pactset Go with organizer, supplier, Crew A, and Crew B: each provider consents to the exact current bundle/version, organizer reserves and activates once, then a separate disposable bundle exercises expiry/refund. Contract fixtures or operator keys are not substitutes for these Freighter signatures.

A protected Preview is available for review. The public deployment and Production environment remain unchanged.

## Pactset Go review (not on the current hosted Preview yet)

The local checkpoint is connected to `pactset-development` and the Pactset Go v1 WASM is registered on Stellar Testnet, but the website changes have not been pushed or deployed. Do not expect the current protected Preview to expose this UI.

After a future reviewed Preview update:

1. Use fresh organizer, supplier, Crew A and Crew B agreements whose independent escrows are current, unfunded, and use the same provisioned Testnet asset.
2. In the organizer event, select 2–8 essential bookings and enter the activation deadline in the displayed event timezone. Review the exact providers, amounts, asset and deadline before signing contract creation in Freighter.
3. In separate browser profiles, each provider opens the same bundle and signs consent with the wallet already bound to that booking. Confirm that a missing or revoked consent prevents reservation.
4. Organizer signs **Reserve exact total**, then signs **Activate all bookings**. One transaction must fund every listed escrow or none. Refresh and reconcile; compare each escrow, the bundle contract, and Stellar Testnet Explorer.
5. On a separate disposable bundle, let the deadline pass, reconcile to expired/refundable, then sign one refund. Retry and confirm there is no duplicate refund.
6. As an unrelated account, deep-link to both bundle IDs and confirm no bundle, booking or transaction data is returned. As support, confirm a database role alone does not provide an organizer/provider signing action.

Automated fixture-key tests and WASM upload are not Freighter extension evidence. Record the fresh bundle contract ID and transaction hashes only after the private wallet rehearsal succeeds.

## First wallet rehearsal after the navigation repair

1. Pass the Vercel Preview gate, then sign in to Pactset as the organizer; these are separate authentication steps.
2. Open **Wallet & payments** from the shared navigation, choose **Select wallet**, then choose **Freighter — Recommended**.
3. Approve site access in Freighter, switch to **Stellar Testnet** if prompted, and sign the ownership message. It cannot transfer funds.
4. Have the supplier sign in in a separate browser profile and complete the same ownership check with a different Testnet wallet.
5. From the supplier workspace follow **Requests → your offer → accepted booking → Open wallet and payment details**. The deterministic next step will say which participant acts.
6. As organizer, open the same booking, review and sign **Create escrow**, then request the exact-output XLM quote. Confirm asset code plus issuer, exact receive amount, maximum XLM spend, fee, slippage and expiry before signing.
7. After conversion confirmation, use **Fund this booking**. If funding fails, retry funding from the converted balance; do not convert again.
8. Supplier submits private evidence; organizer approves only after review; both profiles refresh and confirm the genuine Testnet hash and recipient balance.
9. Supplier may separately keep the test asset, convert it, or create the clearly simulated withdrawal rehearsal. A recipient conversion failure does not undo release.

For Crew A and Crew B, repeat steps 2–8 in separate browser profiles with their own eligible agreements and distinct wallets. The owner acting as support signs in separately, opens only an assigned case, and must also connect the exact disclosed resolver wallet before an authorized disputed release/refund. Unassigned cases must remain invisible. Email confirmation/recovery and real Freighter signing stay unverified until these private steps are completed on the current protected Preview.

## Verified Vercel target and protection

- Existing project: `pactset`, project ID `prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`, under the `miracle352` Hobby scope. The linked Git remote remains `https://github.com/miracle352/Pactset.git`.
- The Vercel dashboard was inspected read-only on 2026-10-05. **Vercel Authentication / Require Log In** is enabled with **Standard Protection**. Password Protection is disabled and requires a paid upgrade, so it is not part of this plan. Protected sourcemaps are enabled and the OPTIONS allowlist is off.
- Use a generated Preview `*.vercel.app` deployment only. Do not assign a custom domain, add a deployment-protection exception, promote it, or change Production.
- Standard Protection runs before the deployment and therefore covers every path served by Vercel, including pages, static assets, route handlers and any future same-origin Next.js APIs. Reviewers must be logged into Vercel and belong to the team. If an outside reviewer needs access, create a deployment-specific Vercel Shareable Link; treat it as a bearer bypass, share it privately, and revoke it after review.
- Supabase Edge Functions and Storage use `*.supabase.co`, so Vercel Authentication cannot cover those external origins. They are separately protected by the caller's Supabase JWT, server-derived role/agreement membership, RLS, a private `milestone-evidence` bucket, and 60-second signed evidence URLs. A direct expired URL must fail; an unrelated authenticated account must not be able to mint a URL.
- The Codex Vercel connector still returns `403 Not authorized` for the `miracle352` scope. The independently authenticated browser was used instead; do not keep retrying the connector.

The review target is the **Preview** branch `codex/stage-2b-preview` at `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app`. Deployment `dpl_2oUWebpMY1JN6QBSVSnBWSUz7PeX` rebuilt commit `413bcd7d415ffc314c128ff2a1ef894ed30cc969` with the branch-scoped configuration. It was not created with `--prod`, assigned a custom domain, or promoted. Production continues to track `main`.

Unauthenticated HTTP requests to both `/` and `/auth/sign-in` returned a Vercel SSO `302`, `Cache-Control: no-store`, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex`. A Vercel-authenticated project owner reached the Pactset landing and sign-in pages. Each browser profile used for the rehearsal must therefore pass the Vercel gate first, then sign into Pactset separately.

## Preview-only configuration

The following variables are configured only for `codex/stage-2b-preview`:

| Variable | Preview value/source | Exposure rule |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `pactset-development` project URL (`lvpsemqalftvcqkrjsyu`) | Public project endpoint; never point to Fieldwork/canary |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Active publishable key for `pactset-development` | Public client key; never use `service_role` |
| `NEXT_PUBLIC_SITE_URL` | Exact protected Preview origin | Public URL used to construct auth redirects |

Source inspection confirms the deployed Next.js app reads only these three `NEXT_PUBLIC_*` values. Stellar Testnet network and Horizon/Soroban endpoints are enforced in the checked-in Supabase Edge Functions. Do not add unused Stellar variables, issuer, liquidity, automated-test, wallet secret, seed phrase, Supabase service-role key, or evidence signing credential to Vercel. Issuer/liquidity provisioning remains an offline development operation. Supabase supplies its own server credentials to the deployed Edge Functions.

Supabase Auth now uses the exact protected Preview origin as its Site URL. The owner approved and the dashboard visibly confirmed these entries on 2026-10-05:

- Site URL: `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app`
- Redirect: `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app/auth/confirm**`
- Redirect: `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app/auth/update-password`

The existing `http://localhost:3000/**` redirect remains for developers. No broad Vercel wildcard or public Production URL was added.

## Access and credentials

1. Open the branch Preview URL and sign into Vercel with an account that has access to the `miracle352` project. This Vercel gate is separate from Pactset authentication.
2. The development account credentials remain only in ignored `.stage2a-test-state.local.json`. On the owner's machine, open that file locally in Codex or another local editor; do not paste it into chat, commit it, upload it, or add it to Vercel.
3. An outside tester who is not a Vercel project member needs a deployment-specific Shareable Link. It is a private bearer bypass: create it only for that tester, send it privately, and revoke it after review. None was created automatically.

## Reconciliation on restricted staging

- The browser persists a pending transaction row before submission, polls after wallet signing, and exposes **Reconcile pending transactions** after refresh. The authenticated Edge Function validates network, hash, contract, agreement, signer, asset and amount before changing projected payment state.
- The review preview uses this caller-scoped reconciliation on submit, refresh and manual retry. Duplicate clicks reuse the operation idempotency key and confirmed conversion prevents a second conversion before a funding retry.
- Vercel Hobby cron is unsuitable for this Preview workflow: scheduled jobs run against Production and Hobby frequency is limited. Do not add a Preview cron or expose a public unauthenticated reconciliation endpoint.
- Developer fallback, from an environment with the ignored development credentials, is `npm run payments:reconcile`. Before production, add a separately authenticated scheduled worker or queue and document its operational ownership; that later production operation is not claimed here.

## Ordered real Freighter signing test

1. Install Freighter only from its official source. Create a disposable wallet, switch it to **Testnet**, and fund it only with Friendbot Testnet XLM. Never paste a seed phrase into Pactset or the test report.
2. Open the protected Preview and sign into the organizer development account in a dedicated browser profile. Confirm the screen says **Stellar Testnet — no real monetary value**.
3. Open fresh accepted agreement `b6346e29-c5ba-488c-aade-8e454df973d6` (5 TUSD). It deliberately has no escrow and no operator wallet. In each account choose **Verify a different wallet**, select a distinct Freighter Testnet account, and sign the single-use ownership challenge. Reject once to verify the declined state, retry, then confirm the active address and Testnet network. This does not rewrite public keys on older escrows.
4. As organizer, choose **Create escrow**. Review the accepted agreement version, exact TUSD asset/issuer, participants, milestone amounts and disclosed resolver; sign the contract-creation envelope in Freighter. Refresh or use reconciliation until the confirmed contract identifier appears. Retrying or double-clicking must not create a second escrow.
5. Request a TUSD quote. Check asset code **and issuer**, exact output, maximum XLM input, fee, illustrative-rate label, slippage and expiry before signing.
6. Add the displayed TUSD trustline if requested, sign the conversion, wait for a real Testnet hash, refresh, and confirm reconciliation does not offer a second conversion.
7. Sign escrow funding as a separate transaction. If it fails, retry funding from the converted TUSD balance without converting again.
8. In the provider's separate profile/wallet, upload an allowed private image/video and note, then sign milestone submission. Verify progress/retry and that an unrelated account cannot open the evidence.
9. Back as organizer, request one correction, have the provider resubmit, then approve/release. Confirm the Explorer link, ledger result, exact recipient balance increase, and zero duplicate release on double-click/refresh. Repeat a later end-user conversion with TEUR through the same generic flow; TUSD must never be substituted.

## Organizer, supplier, two-crew and support rehearsal

Use a separate browser profile and a distinct Testnet wallet for every participant. Record agreement IDs, asset code/issuer, public wallet addresses, transaction hashes, expected/actual amounts and outcomes—never passwords, seeds, private media URLs or access tokens.

1. **Organizer:** create/resume an event, publish one supplier request and two non-conflicting crew requests, accept the current supplier/crew terms, then convert and fund each fresh agreement.
2. **Supplier:** discover only the privacy-safe request, submit an offer, accept the current counteroffer, submit evidence and receive one exact released milestone.
3. **Crew A:** accept the first eligible shift, verify its schedule/countdown, submit evidence and receive only Crew A's agreement payment.
4. **Crew B:** accept a distinct shift, then attempt one overlapping shift and confirm the conflict is rejected. Verify Crew B cannot read or spend Crew A's agreement.
5. **Unrelated account:** confirm it cannot read private drafts/evidence, change offers, release funds, or self-assign support.
6. **You as support:** sign in with the server-assigned support identity. Open only the assigned/disclosed disputed case, confirm the on-chain resolver address, freeze ordinary release, and resolve/refund only the authorized unreleased milestone. Confirm completed transfers remain irreversible and support has no AI/payment override.
7. Refresh and sign in again in every profile. Confirm sessions, agreements and ledger-derived funded/released/refunded/remaining totals persist.

Normal signup email confirmation and password-recovery email links remain **unverified** until their real links are received and exercised. Dashboard auto-confirm is limited to development fixtures and does not count as email-flow verification.

The dedicated support identity is bound to the disclosed development resolver through a fixture-signed ownership challenge. Agreement participants can open a case, assignment is server-controlled, and assigned support receives only case-authorized related access. This fixture binding proves the policy path, not the owner's Freighter extension. Use a fresh disputed agreement for the real resolver rehearsal; settled history must not be rewritten.

## Developer-only local commands

```powershell
npm install
npm run dev
npm run payments:reconcile
npm run payments:verify-failures
npm run typecheck
npm run lint
npm test
npx next build --webpack
```

Reviewers are not required to set up the project locally.

## Messaging and support Preview check

1. Use separate organizer and provider browser profiles. Open the same accepted agreement and its **Messages** section.
2. Send one ordinary message. Confirm the other participant receives one notification, opens the correct agreement, and deliberately marks it read.
3. Retry a send only after a visible failure. Confirm only one copy appears after refresh/reconnect.
4. Request French or another reading language. Until a provider is configured, expect **Translation unavailable** and an unchanged, readable original; do not treat this as translated output.
5. Send a message containing `@support`. Confirm the existing active case is linked (not duplicated), participants see pending/assigned status, and only the assigned support identity can enter the related private record.
6. Sign in as the unrelated account and confirm the agreement, messages, translation rows, case and notifications are not visible. A soft not-found/denial is expected.
7. Repeat at 390px with the software keyboard visible: the composer, notification sheet and send action must remain reachable without horizontal overflow.
8. Attach a permitted small image or PDF. Confirm upload progress, remove/cancel before sending once, then send it. The other participant and assigned support can open a 60-second private link; the unrelated profile cannot list the metadata or mint a link. HTML and SVG must be rejected.
9. Open Notifications on desktop and mobile. Confirm the desktop popover does not change header height, the list scrolls independently, mobile focus stays in the sheet, Escape/Close returns focus, and opening the panel alone leaves unread state unchanged.

## 2026-10-10 frontend Preview verification

- Branch-only delivery: `codex/stage-2b-preview`; Production/main/custom domains were not changed.
- Stable review URL: `https://pactset-git-codex-stage-2b-preview-miracle352.vercel.app`.
- Unauthenticated HTTP inspection returned Vercel SSO `302`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex` before the push. The authenticated in-app browser then loaded the new chapter navigation, connected event story, evidence section, preparation countdown and footer from the same URL.
- A deployed 390×844 interaction opened the viewport-level navigation drawer at 770px high with organizer, supplier and crew choices, six chapter links, dark-only rendering, a split-flap display and `scrollWidth === clientWidth`. A deployed 1440px visual inspection confirmed the compact desktop header, hero actions, photograph and architectural lines.
- The circular black side control visible in the protected deployed capture belongs to the Vercel Preview toolbar. The black **N** visible in local development captures is the Next.js dev indicator. Neither is Pactset navigation and neither ships as ordinary Production application UI.
- Real Freighter extension signing, mobile-wallet handoff, confirmation email and recovery email remain private manual checks; fixture signing is not counted as extension evidence.

## 2026-10-10 correction-pass deployment checks

After the correction commit reaches the protected Preview:

1. At 390×620, open public navigation at the top and after scrolling. Confirm the chapter rail is hidden, the menu ends before the viewport bottom, direct role links work, Escape restores focus and background scrolling returns.
2. Sign in as the development supplier. While scrolled, open Account, Wallet, role and More separately. Confirm every sheet is fully in the viewport, Close works, lower wallet controls are reachable by internal scrolling and dismissed sheets do not intercept taps.
3. At 1440×900, open the wallet dropdown and confirm the authenticated header remains 64px high; use Manage wallets for balances/full detail.
4. Open supplier signup at 390×844. Confirm the role, compact wallet boundary, Back to home button, form fields, password control and submit action are reachable without horizontal overflow.
5. Scroll naturally to Event preparation. Observe the illustrative split flap change, all four checkpoint arrivals and the persistent final state; Replay must restart both. With reduced motion enabled, the complete static explanation must remain visible without flipping.
6. The black Vercel side control is Preview tooling. Do not treat it as Pactset UI or remove application accessibility features to hide it.

Current automated scope is Chromium touch emulation, not physical iPhone Safari. Playwright WebKit is not installed on this host. Real Freighter, mobile wallet, confirmation email and recovery email remain manual/private gates.

## Local focused-experience review before the next Preview update

This checkpoint is intentionally local. Before a future protected-Preview update, replay `node scripts/qa/verify-glass-redesign.mjs`, then privately verify:

1. Signed out: Get started exposes exactly organizer, supplier, and crew routes; mobile exposes the same destinations.
2. Signed in: the landing header shows one Open workspace action, one account menu, and a distinct Sign out action.
3. Supplier: Requests → offer → accepted booking → wallet/payment remains the real-data path; no sample agreement is granted to a new account.
4. Wallet: the compact header control opens the real picker; an unavailable or locked Freighter leaves ordinary workspace use available.
5. Reduced motion: text is immediately visible, Lenis animation is disabled by preference, and preparation content remains understandable without movement.
6. Do not mark username sign-in, confirmation email, recovery email, or real Freighter signing verified until their secure deployed/private flows pass.

## Wallet discovery and recipient payout review

For a newly registered supplier, use the real authenticated workspace rather than **Solo Test Lab**:

1. Open **Account → Wallet and Testnet**, or use **Wallet** in the desktop sidebar/mobile bottom navigation.
2. Verify Freighter is on **Stellar Testnet**, then select **Connect Freighter**. Pactset signs a single-use ownership challenge; it never asks for a seed phrase.
3. Return to **Requests**, open a matching published request, submit an offer, and accept the same current version as the organizer.
4. Open **Bookings**, choose the accepted booking, then select **Open wallet and payment details**.
5. If no booking exists, the empty state explains the prerequisites and does not add private fixtures to the account.

After a milestone release is confirmed, the supplier or crew member sees **Choose what happens to earned funds**:

- **Keep T…** requires no transaction; the agreed Testnet asset remains in the escrow-recipient wallet.
- **Convert** requests a strict-send quote from the released asset to XLM or another provisioned Stellar Testnet asset. The recipient reviews exact input, expected/minimum output, fee, slippage and expiry before Freighter signs.
- **Sandbox withdrawal** creates only a fictional rehearsal record. It does not contact a bank or anchor, move tokens, prove redemption, collect KYC, or turn test assets into money.

Receiving, conversion, sending to another wallet and off-ramp withdrawal are separate actions. Direct recipient transfers and a real anchor are deferred; no control claims arbitrary-chain tokens or a bank payout.

## First protected-Preview Freighter checklist

1. Pass the Vercel Preview gate, then sign into Pactset separately.
2. Open **Account → Wallet and Testnet** and connect a fresh Freighter account on Testnet.
3. Have the other agreement participant sign in through a separate browser profile and verify a different Testnet wallet.
4. From an accepted agreement, let the organizer select **Create escrow**, review the bound version, participants, asset, milestones and resolver, then sign.
5. Request the exact-receive XLM quote, check maximum spend/fee/expiry/slippage, sign conversion, then sign escrow funding as a separate step.
6. As supplier or crew, upload private evidence and sign submission. As organizer, request a correction once, then approve and release after resubmission.
7. As the recipient, keep the asset or request a separate conversion to XLM/another listed provisioned asset; confirm the release remains successful even if the later conversion is rejected.
8. Open every confirmed hash in Stellar Expert Testnet and compare the agreement asset, issuer and amount. Refresh and use **Reconcile pending transactions** to prove recovery without duplication.

Freighter extension signing remains unverified until these steps are performed privately by the owner. Automated fixture-key transactions are evidence of the server/API/ledger path only.
