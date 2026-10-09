# Pactset current implementation plan

Authoritative brief: 2026-10-09. Self-reviewed against the repository and requirements matrix; no independent review has been claimed.

## Phase 1 — dark-only usability repair

- Force dark rendering before first paint and remove every theme control.
- Remove demo entry points from the main journey; route new users to real role signup and empty workspaces.
- Repair landing headline, How it works layout, button states, role switching, active navigation, settings/wallet shell consistency, mobile navigation, password reveal controls, and workspace loading/error states.
- Add a compact authenticated wallet control that distinguishes saved verification from current browser/provider/network readiness.
- Verify with source checks, TypeScript, lint, product tests, production build, and responsive browser QA. Commit separately.

## Phase 2 — practical event workflows

- Audit and extend existing persistent event, request, offer, agreement, evidence, support, profile, and budget models instead of creating parallel fixtures.
- Add role-specific next actions, richer rows, event-team context, deadline exceptions/extensions, versioned evidence corrections, messages/translation boundaries, discovery/list alternative, replacements, reputation eligibility, and a deterministic manual budget path where external AI is unavailable.
- Add versioned SQL migrations with explicit grants/RLS and exercise actual client/server paths. Commit separately.

## Phase 3 — acknowledged material changes

- Add versioned event change requests, affected-agreement snapshots, participant acknowledgements/adjustments, audit history, and stale financial/bundle approval invalidation.
- Preserve original accepted terms until the affected parties accept the new version and any additional funding is secured. Commit separately.

## Phase 4 — Pactset Go

- Document the state machine and compatibility boundary with independent escrows.
- Implement a bounded, one-asset Soroban bundle contract with version-bound consents, reservation ownership, expiry, all-or-none activation in one transaction, and authorized refunds.
- Add migrations, server preparation/reconciliation, role UI, contract/property/integration tests, and isolated Testnet deployment evidence. Do not expose a partial feature as active. Commit separately.

## Phase 5 — integrated verification and handoff

- Use isolated organizer, supplier, two-crew, support, and unrelated accounts.
- Verify persistence, access denial, wallet/payment regressions, event changes, evidence corrections, support, replacement funding boundaries, and Pactset Go success/failure cases.
- Check 360/390/430/768/1440 widths, short mobile, enlarged text, keyboard, reduced motion, dark-only behavior with old light preferences, and production performance.
- Update the handoff, requirements matrix, staging test plan, screenshots/recording, commands, genuine transaction evidence, skipped checks, and remaining blockers. Keep all commits local.
