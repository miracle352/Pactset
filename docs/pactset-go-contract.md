# Pactset Go contract boundary

Status: local implementation checkpoint; disabled in the application until migration, wallet preparation, Testnet deployment, and browser reconciliation pass.

## Purpose and compatibility

Pactset Go activates a bounded set of already accepted, independently deployed Pactset escrows in one Soroban invocation. Legacy agreements remain on their existing independent path. A bundle accepts 2–8 bookings, one Stellar asset, one organizer, exact agreement hashes and versions, provider wallets, escrow contract addresses, amounts, and one activation deadline.

The bundle temporarily holds organizer-owned Testnet funds. Activation returns the reserved total to the organizer and invokes every listed escrow's existing `fund` function within the same Soroban transaction. Each escrow re-checks its own payer, payee, asset, version, and unfunded state. Soroban transaction atomicity means one failed check or escrow funding call reverts the complete activation, including every earlier transfer. No sequence of database writes is called atomic.

## Authoritative interface

Consumer: Pactset's wallet transaction preparation and bundle UI. Provider: `contracts/pactset-go`.

- `__constructor(bundle_hash, organizer, asset, activation_deadline, bookings)`
- `consent(index)` — exact listed provider authorizes the exact stored booking.
- `revoke(index)` — provider withdraws consent before funding/activation.
- `reserve()` — organizer authorizes transfer of the exact total into bundle custody after every consent.
- `activate()` — organizer authorizes one call which validates all stored/current escrow terms and funds every escrow atomically.
- `expire()` — permissionless state transition after the disclosed deadline.
- `refund()` — organizer authorization returns an expired reservation once.
- `cancel()` — organizer cancels before activation and receives any reserved balance once.
- `get_config()`, `get_bookings()`, `status()` — read-only reconciliation.

All amounts are signed 128-bit Stellar contract token units. Hashes are fixed 32-byte values. Addresses remain opaque Soroban addresses.

## State machine

`CollectingAcceptances` → `AwaitingFunds` → `ReadyToActivate` → `Active`

- Constructor begins at `CollectingAcceptances`.
- The last exact provider consent advances to `AwaitingFunds`.
- A revocation before reservation returns to `CollectingAcceptances`.
- Successful organizer reservation advances to `ReadyToActivate`.
- Successful atomic activation advances to `Active`.
- Passing the deadline derives `Expired` when unfunded and `Refundable` when funded; `expire()` persists that state.
- `refund()` moves `Refundable` → `Refunded` and transfers the exact held total once.
- `cancel()` moves any pre-activation state → `Cancelled`, returning the exact held total if present.

There is no transition out of `Active`, `Cancelled`, or `Refunded`. Pactset Go cannot reverse released milestones, adjudicate a dispute, or spend funds held by an agreement escrow.

## Authorization and invariants

- Only the exact provider wallet stored at an index can consent or revoke it.
- Only the organizer can reserve, activate, cancel, or claim an expiry refund.
- Consent is bound to bundle hash, booking index, agreement hash/version, provider, escrow, amount, asset, and deadline through stored constructor state and Soroban authorization context.
- At activation, every escrow must still identify the same organizer payer, provider payee, asset, agreement hash/version, and exact total, and must be unfunded.
- The total is checked with overflow-safe arithmetic; addresses and agreement hashes cannot repeat; booking count is capped at eight.
- Funding, activation, cancellation, and refund are single-use state transitions.
- Database projections are never authoritative for funds. Reconciliation reads contract state and transaction confirmation.

## Application states

The UI may show: collecting acceptances, awaiting funds, ready to activate, activation pending, active, expired, refundable, refunded, cancelled, or failed. `activation pending` and `failed` are transaction-submission states, not contract states. The feature remains unavailable until the contract ID and WASM hash are registered for Stellar Testnet.

## Known limitation

This first contract version requires new or unfunded compatible Pactset escrow contracts. It does not retrofit funded legacy agreements, span assets, guarantee physical attendance, or combine replacement funding with disputed/owed balances.
