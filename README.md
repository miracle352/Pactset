# Pactset

Pactset is a staged global event-operations platform built around Stellar Testnet. This repository currently contains **Stage 1 only**: the product spec and requirements ledger, Opal/Obsidian design foundation, landing page, role shells, regional preferences, fictional demo path, and deployment setup.

Stage 1 does not include authentication, live accounts, providers, wallets, balances, payments, blockchain transactions, AI, chat, uploads, schedulers, or working 3D. Any data shown in the demo is fictional and labeled.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local setup

```bash
npm ci
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

Copy `.env.example` to `.env.local` only when a later stage requires server-side configuration. Stage 1 requires no secrets. Never commit `.env.local`, wallet seeds, issuer/admin secrets, or private keys.

## Documentation

- Product specification: `docs/product-spec.md`
- Requirements matrix: `docs/requirements-matrix.md`
- Staged implementation plan: `docs/implementation-plan.md`
- Progress and evidence: `docs/progress.md`

## Network safety

All future blockchain work is restricted to Stellar Testnet and Pactset demonstration assets. TUSD, TGBP, and TAUD are fictional test assets with no real-world value or redemption promise.
