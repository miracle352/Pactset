# Pactset release runbook

Last updated: 2026-10-12 (Africa/Lagos)

## Runtime boundary

- Website: the existing Vercel project `pactset`.
- Database, Auth, Storage and Edge Functions: Supabase project `pactset-development` (`lvpsemqalftvcqkrjsyu`).
- Blockchain: Stellar **Testnet only**. Test assets have no monetary value.
- Production URL: `https://pactset.vercel.app`.
- Privileged fixture scripts are developer-only commands. They are not exposed as public application routes.

## Local startup

1. Install the Node version declared in `package.json` (`>=22.12.0`) and run `npm install`.
2. Create an ignored `.env.local` containing the public Supabase URL and publishable key. Add privileged development values only when running an authorized admin/worker script; never prefix them with `NEXT_PUBLIC_`.
3. Run `npm run dev`, then open `http://localhost:3000`.
4. Before release, run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `cargo test --workspace` from `contracts/`.

## Background and recovery work

- In-app deadline reminders run in `pactset-development` through the private Postgres cron job `pactset-in-app-reminders`. It runs every minute, uses deduplicated jobs and skip-locked worker claims, and does not provide email or push delivery.
- Developers can run the same reminder worker with `npm run reminders:process`. It requires the ignored server-side Supabase service credential.
- Payment reconciliation runs after transaction submission, on payment-view refresh, and through the authenticated reconciliation action. For recovery/operations, run `npm run payments:reconcile` with authorized ignored server-side credentials.
- There is no separate continuously running Vercel reconciliation worker. A transaction interrupted before client reconciliation remains recoverable through the authenticated action or the operator command above.

## Deployment

1. Create a pull request from `codex/stage-2b-preview` to `main`.
2. Require the application tests, TypeScript, lint, Soroban tests and a successful Vercel Preview build. Review the outgoing diff and secret scan.
3. Merge normally; do not force-push or bypass checks.
4. The existing Vercel Git integration builds `main` as Production. Never use a new Vercel project.
5. Production needs only the three public web values: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase/Gemini service secrets remain in Supabase Edge Function Secrets, not Vercel or the browser bundle.
6. Confirm Supabase Auth retains exact Production confirmation and recovery routes, plus the existing Preview and localhost routes.
7. Verify the deployed commit, public navigation/auth entry, private-route redirect, Testnet labels and absence of browser console errors.

## Rollback

1. In Vercel, open the last known-good Production deployment and use **Promote to Production** / **Rollback**. This restores the application deployment without rewriting Git history.
2. If code rollback is also required, create a normal revert pull request against `main`; do not force-reset shared branches.
3. Do not reset Supabase migration history. Stage 2–4 migrations are additive and existing ledger/history rows must be preserved. If a database defect is suspected, stop writes for the affected feature and apply a reviewed forward migration.
4. Re-run the Production smoke checks and record the restored deployment ID and commit.

## Release limitations that remain explicit

- Email confirmation succeeded through a real owner-run link. Password recovery, expired/reused-link edge cases and old-password rejection remain unverified.
- Real Freighter signing for the prepared TUSD and TEUR agreements remains unverified. Automated fixture signing is not browser-wallet proof.
- The complete organizer/supplier/Crew A/Crew B Pactset Go rehearsal remains unverified even though nine contract tests pass.
- Email/push reminders, venue discovery, automated cancellation decisions, and real bank/anchor withdrawal are not available. Any withdrawal rehearsal is clearly simulated.
