# Restricted staging test plan

## Protection and configuration

The existing Vercel project is `pactset` (`prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`). Read-only inspection found Vercel Authentication enabled for `all_except_custom_domains`; password protection is off. Do not change or alias the public custom domains. When authorized later, create a non-production preview and keep its generated `*.vercel.app` URL behind Vercel Authentication. Confirm protection signed out before sharing it. No paid password-protection upgrade is required.

Use development-only variables scoped to Preview, pointing only to `pactset-development` and Stellar Testnet. Add exact preview callbacks in Supabase Auth for `/auth/confirm` and `/auth/update-password`; use an account-scoped preview wildcard only when exact ephemeral URLs are impractical. Leave Production variables and the public site unchanged.

## Beginner-friendly future staging test

1. Install Freighter from its official source, create a testing wallet, select Testnet and fund only with Friendbot Testnet XLM. Never enter a seed phrase into Pactset.
2. Open the protected preview. Use a separate browser profile for every Pactset identity so sessions and wallets cannot mix.
3. Organizer: connect the organizer wallet, sign the ownership challenge, inspect the fresh agreement quote (asset code **and issuer**, exact output, max input, fee, slippage, expiry), then sign conversion and funding separately.
4. Provider: sign in with its own wallet, upload an allowed private photo/video plus note, verify progress, then sign milestone submission.
5. Organizer: review the private evidence, request a correction once, then approve/release after resubmission. Verify the genuine Testnet hash and exact provider balance increase.
6. Repeat conversion using TEUR and its registered issuer; confirm TUSD is never substituted.
7. Unrelated account: confirm the agreement and direct evidence/payment URLs reveal nothing.
8. Refresh while pending and reconcile. Retry/double-click must not create a second transfer.

## Organizer, supplier, two-crew and support rehearsal

- Organizer publishes and accepts terms, converts/funds, reviews evidence and releases.
- Supplier submits an offer and receives one exact confirmed milestone.
- Crew A and Crew B use distinct accounts/wallets, accept separate non-conflicting shifts, submit separate evidence and cannot read/spend each other's agreements. Attempt one conflicting shift and confirm rejection.
- You act as support through a server-assigned account only. Confirm public signup cannot grant support, access only the case disclosing your resolver wallet, resolve only an authorized disputed/unreleased milestone and confirm completed transfers are irreversible.

Record role, agreement ID, asset code/issuer, hash, ledger result and expected/actual balance—never passwords, secret keys, seed phrases or private evidence URLs.

Developers may use `npm run dev` and `npm run payments:reconcile`; the future user rehearsal does not require local setup.
