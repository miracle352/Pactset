# PACTSET

Pactset is an event coordination platform powered by Stellar. It gives organizers, suppliers, and crew one shared operational path from an event brief to agreed bookings, preparation, proof of work, and authorized milestone payments.

Event delivery often breaks down across scattered messages, changing scopes, disconnected schedules, and payment decisions that are difficult to trace. Pactset brings those responsibilities into versioned agreements: organizers can assemble the event team and see what needs attention; suppliers and crew can manage commitments and evidence; assigned support can review a narrowly scoped case without gaining blanket access to private work.

**Production:** [https://pactset.vercel.app](https://pactset.vercel.app)

**Backend:** Supabase project `pactset-development`

## Deployment status

> **Pactset currently runs on Stellar Testnet. Assets used in this deployment have no real monetary value.**

Pactset-issued T-prefixed assets are demonstrations, with no redemption promise or affiliation with similarly named tokens. The application is not Mainnet-ready and does not provide real bank withdrawals. Any withdrawal rehearsal is explicitly labelled as a simulation.

## How Pactset works

- **Organizers** create event briefs and budgets, publish requests, compare offers and counteroffers, accept versioned terms, coordinate preparation, review evidence, and authorize eligible payments.
- **Suppliers** publish services and availability, manage capacity, respond to requests, prepare accepted bookings, submit evidence, and receive the asset agreed in the booking.
- **Crew** maintain skills, rates, and availability; accept non-conflicting assignments; follow event-local deadlines; and provide the evidence required for their milestones.
- **Assigned support** works only on server-assigned cases with an audit trail. Case access does not itself authorize an on-chain payment decision; contract permissions and the disclosed resolver wallet still apply.

Implemented product capabilities include persistent role-based workspaces, event briefs, editable budgets, requests, versioned offers and agreements, replacement invitations, capacity protection, preparation deadlines, private evidence and corrections, participant messaging, scoped support, reviews, and in-app notifications.

Ordinary planning, requests, offers, messages and bookings do not require an unlocked wallet. Pactset account authentication and Stellar wallet connection are separate.

## Powered by Stellar

Stellar is the payment and settlement layer for accepted Pactset agreements. It connects the organizer's funding decision to the provider's agreed milestone without making planning, messaging, or ordinary booking work dependent on an unlocked wallet.

### XLM conversion into supported Stellar assets

An organizer can review an exact-receive quote that converts Testnet XLM into the agreement's supported Stellar asset. The review identifies the asset code and issuer, maximum XLM spend, fees, slippage bounds, and quote expiry. Availability depends on an explicitly provisioned asset and a valid liquidity path; Pactset never silently substitutes TUSD or implies universal currency liquidity.

### Agreement-bound Soroban escrow

Each compatible escrow is bound to the accepted agreement version, organizer and provider wallet addresses, asset, milestone allocation, and disclosed resolver rules. Conversion and funding are separate recoverable operations: if conversion succeeds and funding does not, the converted balance remains available for a funding retry without a second conversion.

### Authorized milestone payments

Providers submit private evidence against the agreed work. The organizer can request corrections or approve an eligible milestone. Release is an explicit authorized contract action, executes once, and pays the agreed asset to the provider wallet; an upload or AI assessment cannot release funds by itself.

### Disputes and reconciliation

Disputed escrow funds stay frozen until an action permitted by the accepted terms and contract authorization is signed. Assigned support has only case-scoped application access and cannot reverse a completed Stellar transfer. Pactset persists pending transactions, reconciles confirmed ledger state after refresh or interruption, prevents duplicate operations, and links confirmed transactions to a Testnet explorer.

### Pactset Go

Pactset Go is the implemented bounded bundle contract and application workflow for essential bookings. A bundle contains 2–8 accepted, compatible, unfunded agreements in one supported Stellar asset. Each listed provider consents to the exact agreement version, wallet, escrow, amount, and activation deadline. The organizer reserves the exact total and can authorize one Soroban activation that funds every listed escrow or reverts the entire activation. Pre-activation cancellation and expiry refunds return only eligible reserved funds; Pactset Go cannot reverse released milestones, adjudicate disputes, combine different assets, or reuse disputed or owed balances.

The contract invariants and application preparation/reconciliation paths have automated coverage. A complete organizer/supplier/two-crew Freighter rehearsal of a fresh bundle remains unverified, so the repository does not present Pactset Go as universally production-proven.

The standard agreement payment path is:

1. An organizer and provider accept the same agreement version and verify distinct Testnet wallets.
2. The organizer creates a deterministic Soroban escrow bound to that agreement version, payer, payee, asset, milestone allocation and resolver rules.
3. The organizer reviews an exact-receive XLM conversion quote for the agreement's registered test asset, then signs conversion and escrow funding as separate recoverable operations.
4. The provider submits private evidence. The organizer may request corrections or approve eligible work.
5. The escrow releases the exact milestone once. Confirmed transactions are reconciled from Stellar and linked to the Testnet explorer.

## Architecture

- Next.js 16 App Router, React 19 and TypeScript
- Supabase Auth, Postgres/RLS, private Storage, Realtime and Edge Functions
- Stellar SDK, Freighter API and Rust/Soroban contracts
- GSAP/ScrollTrigger and Lenis for bounded public-page motion; authenticated workspaces retain native scrolling
- Vercel for the existing web project; Supabase hosts data and server-side integration secrets

Important Edge Functions are `account-auth`, `wallet-auth`, `stellar-payments`, `pactset-go`, `conversation-attachments`, `message-translation` and `budget-suggestions`. Soroban source is under `contracts/pactset-escrow` and `contracts/pactset-go`.

## Requirements

- Node.js `>=22.12.0`
- npm and the committed lockfile
- Rust toolchain with the Soroban-compatible target when testing contracts
- Supabase CLI only when linking, deploying functions or applying reviewed migrations

## Local installation

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Generate linked database types when the intended project is configured:

```bash
npm run db:types
```

### Web environment (`.env.local` locally; Preview/Production scope in Vercel)

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

Only these browser-safe values belong in the web runtime. Never put a service-role key, database password, issuer secret, liquidity key, wallet seed or Gemini key in a `NEXT_PUBLIC_*` variable.

### Supabase Edge Function secrets

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Configure these optional provider secrets privately in **Supabase → pactset-development → Edge Functions → Secrets**:

```text
PACTSET_GEMINI_API_KEY
PACTSET_GEMINI_MODEL                 # optional override
PACTSET_TRANSLATION_ENDPOINT        # optional generic fallback
PACTSET_TRANSLATION_API_KEY         # optional generic fallback
```

Direct Gemini takes precedence when configured. Message text remains authoritative and readable if translation fails. AI budget output is validated, saved only as an editable draft and cannot accept an offer, change an agreement or move funds.

### Operator-only local values

Authorized reminder/reconciliation/admin scripts may require `SUPABASE_SERVICE_ROLE_KEY` in ignored `.env.local` state. Automated Stellar fixtures use ignored local state files. Never commit or paste those values into issues, screenshots or reports.

## Database and server setup

Migrations are versioned under `supabase/migrations` and must be reviewed and applied in timestamp order only to `pactset-development`:

```bash
npx supabase link --project-ref PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked
```

Inspect the linked migration history before pushing. The development project has documented historical version-number drift; do not reset it or blindly mark migrations applied. Deploy the Edge Functions listed above after their corresponding migration and policy review.

Supabase Auth must allow only the intended origins and callback routes:

- `http://localhost:3000/**`
- the exact protected Preview confirmation/recovery routes
- `https://pactset.vercel.app/auth/confirm**`
- `https://pactset.vercel.app/auth/update-password`

Normal email confirmation remains enabled.

## Workers and reconciliation

- Hosted in-app reminders run every minute through the private Postgres cron job `pactset-in-app-reminders`. This is not email or push delivery.
- Local/operator reminder fallback: `npm run reminders:process`.
- Payment state reconciles after submission, on payment-view refresh and through the authenticated reconciliation action.
- Operator recovery command: `npm run payments:reconcile`.
- There is no continuously running Vercel reconciliation worker; interrupted pending transactions remain recoverable through the authenticated action or operator command.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e

cd contracts
cargo test --workspace
```

Development-only authorization and integration verifiers are exposed as package scripts. They require ignored fixture credentials and must target only `pactset-development`; they are not public product routes.

## Beginner-friendly testing

1. Open Production and create an Organizer, Supplier or Crew account. Support is never a public signup role.
2. Confirm the email, choose one unique public username and enter the empty role workspace. Private fixture agreements are not attached to new accounts.
3. Create an event and publish a request as organizer. Use a separate browser profile/account to submit a supplier or crew offer, then accept the same current terms from both sides.
4. Open the accepted booking's **Wallet & payments** view. Planning still works if Freighter is absent or locked.
5. For payment rehearsal, each participant must connect a distinct Freighter address on **Stellar Testnet**, approve the expiring ownership challenge, then approve each displayed transaction separately. Never share a seed phrase or private key.
6. Verify that an unrelated account sees only a privacy-preserving unavailable state. Assigned support can open related records only after server-controlled assignment.

The ignored local test documentation identifies dedicated development account labels for fixture rehearsals. Credentials and private fixture links are intentionally not published here.

## Implemented and verified

- Real accounts, role onboarding, usernames, regional/timezone/test-currency preferences and persistent event drafts
- Requests, versioned offers/counteroffers, accepted agreements, replacement invitations and atomic capacity checks
- Private evidence, correction history, participant messaging/attachments, translated-message fallback, scoped support and in-app notifications
- Testnet asset registry and liquidity status, wallet ownership challenges, quotes, conversion/funding preparation, agreement escrow, milestone release, disputes and ledger reconciliation
- Editable budgets, booking-backed reviews, portfolio visibility controls and scheduled in-app reminders
- Dark-only responsive glass interface with reduced-motion behavior

## Deferred or still unverified

- Real Freighter signing for the prepared TUSD and TEUR browser rehearsals
- Password-recovery email completion, old-password rejection and every expired/reused-link edge case
- Full organizer/supplier/Crew A/Crew B Pactset Go browser rehearsal
- Email/push reminder delivery and unattended Vercel reconciliation
- Venue discovery directory, production AI planning beyond the bounded adapters, automatic cancellation decisions and real anchor/bank withdrawal
- Physical-device mobile-wallet and software-keyboard coverage

Automated fixture signing proves contract and authorization behavior, not a user's Freighter extension experience. See the requirements matrix for the precise status of every retained feature.

## Deployment and rollback

Changes flow from `codex/stage-2b-preview` through a reviewed pull request to `main`. Vercel builds the existing project from `main`; do not create a duplicate project or promote an unchecked Preview. Production uses `pactset-development` and Stellar Testnet.

See [docs/release-runbook.md](docs/release-runbook.md) for the complete startup, worker, deployment, callback, smoke-test and rollback procedure.

## Documentation

- [Product requirements](docs/product-spec.md)
- [Requirements matrix](docs/requirements-matrix.md)
- [Latest handoff](docs/HANDOFF.md)
- [Staging and rehearsal plan](docs/staging-test-plan.md)
- [Pactset Go contract boundary](docs/pactset-go-contract.md)
