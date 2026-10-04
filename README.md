# Pactset

Pactset is a staged global event-operations platform built around Stellar Testnet. The repository contains the verified public foundation plus the Stage 2A application code for accounts, persistent event drafts, provider requests and offers, and accepted but unfunded agreements.

Public demo routes use clearly labeled fictional data. Authenticated features require a dedicated Supabase development project and the migration in `supabase/migrations`. Wallets, balances, payments, blockchain transactions, AI, chat, uploads, schedulers, and interactive 3D remain later work.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local setup

```bash
npm ci
npm run db:types # after linking the intended Supabase project
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Environment

Copy `.env.example` to `.env.local` and replace only the documented placeholders. The Supabase URL and publishable key are safe client identifiers; never place a service-role key, database password, wallet seed, issuer secret, or private key in a `NEXT_PUBLIC_*` variable or commit it.

Configure Supabase Auth with these redirect destinations:

- Local development: `http://localhost:3000/auth/confirm`
- Production: `https://pactset.vercel.app/auth/confirm`
- Vercel previews: add the exact preview-domain wildcard shown for the linked `miracle352/Pactset` Vercel project; do not authorize unrelated domains.

Apply `supabase/migrations/20261004133435_stage_2a_core.sql` only to the dedicated Pactset development project. The migration enables row-level security, removes anonymous table access, and exposes constrained authenticated functions for publishing, negotiation, and acceptance.

## Documentation

- Product specification: `docs/product-spec.md`
- Requirements matrix: `docs/requirements-matrix.md`
- Staged implementation plan: `docs/implementation-plan.md`
- Progress and evidence: `docs/progress.md`

## Network safety

All future blockchain work is restricted to Stellar Testnet and Pactset demonstration assets. TUSD, TGBP, and TAUD are fictional test assets with no real-world value or redemption promise.
