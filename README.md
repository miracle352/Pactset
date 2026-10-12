# PACTSET

Pactset coordinates event work from the first brief through an approved Testnet milestone payment. Organizers publish requests, compare offers, accept versioned terms, track preparation and review private evidence. Suppliers and crew manage services, availability, bookings, deadlines and earnings. Assigned support receives case-scoped access to the related agreement, conversation and evidence; support cannot self-assign or reverse a completed blockchain transfer.

**Production:** https://pactset.vercel.app

**Network:** Stellar Testnet only

**Backend:** Supabase project `pactset-development`

Pactset-issued T-prefixed assets are demonstration assets with no monetary value, redemption promise or affiliation with similarly named tokens. The application does not provide a real bank withdrawal. Its withdrawal rehearsal is explicitly simulated.

## Product workflows

- **Organizer:** create a persistent event brief and budget, publish supplier/crew requests, review offers and counteroffers, accept the current version, fund an eligible agreement, review evidence and authorize release.
- **Supplier:** publish a service profile and availability, manage inventory capacity, respond to relevant requests, prepare accepted work, submit evidence and receive the agreed test asset.
- **Crew:** maintain skills, rates and availability, accept non-conflicting assignments, follow event-local preparation deadlines and submit required evidence.
- **Assigned support:** work only on server-assigned cases with an audit trail. Database access does not by itself authorize an on-chain resolution; the contract's disclosed resolver wallet is also required.

Ordinary planning, requests, offers, messages and bookings do not require an unlocked wallet. Pactset account authentication and Stellar wallet connection are separate.

## Stellar implementation

The implemented payment path is:

1. An organizer and provider accept the same agreement version and verify distinct Testnet wallets.
2. The organizer creates a deterministic Soroban escrow bound to that agreement version, payer, payee, asset, milestone allocation and resolver rules.
3. The organizer reviews an exact-receive XLM conversion quote for the agreement's registered test asset, then signs conversion and escrow funding as separate recoverable operations.
4. The provider submits private evidence. The organizer may request corrections or approve eligible work.
5. The escrow releases the exact milestone once. Confirmed transactions are reconciled from Stellar and linked to the Testnet explorer.

Conversion success never implies funding success, and a funding retry does not convert again. Asset codes are always paired with issuers. Pactset never silently substitutes TUSD for another agreed asset.

Pactset Go is a separate bounded Soroban bundle contract. It binds 2–8 current agreement versions in one registered test asset, requires the exact providers' consent, reserves organizer funds and activates all eligible essential bookings in one contract invocation or none. Expiry/refund rules apply only to unreleased reserved funds. Existing independent escrows are not described as atomic package booking, and the full multi-person browser rehearsal remains unverified.

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
