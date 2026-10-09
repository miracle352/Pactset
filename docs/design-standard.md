# Pactset design standard

Status: approved architectural event-operations direction, October 2026. This document makes the owner's Personal Web3 and DeFi Design Standard durable for Pactset.

## Current visual authority

The owner's 2026-10-08 adaptation brief is the primary visual direction. Its supplied reference is a source for color, typography, cinematic image treatment, architectural lines, gold signal motion, arrow controls and footer structure—not literal content or a two-section template.

The previous pavilion/3D-building direction is retired. It must not be mounted, combined with this system, or represented as current roadmap work. Old source and evidence may remain in Git history for recovery, but the active product uses editorial photography, SVG architecture and practical product surfaces.

## Creative thesis

Pactset is an event blueprint in motion. Fine architectural lines represent dependencies among venue, suppliers, crew, evidence and payment. Small gold signals identify a decision or responsibility moving through that plan. The signal is illustrative navigation language, never a claim that work or money is confirmed.

The public experience is cinematic and editorial. Authenticated work is quieter, denser and operational. Financial pages prioritize exact amounts, assets, participants and state over spectacle.

## Visual tokens

- Deep teal `#061f1e`: primary dark ground and high-trust financial context.
- Dark green `#103f3c`: secondary dark sections, framing and footer surfaces.
- Gold `#dfa12d`: decisions, controlled emphasis, current step and traveling line signals.
- Off-white `#f3f5ef`: dark-theme foreground and light-theme ground.
- Light mode uses off-white and pale botanical neutrals with dark teal ink. It is the same identity in daylight, not an unrelated palette.
- Typography uses Inter/system sans-serif. Georgia/Times italic is reserved for a few editorial phrases such as “shared plan,” never routine labels or numbers.
- Borders are fine and structural. Glass is selective framing; forms and financial data use dense, readable surfaces.
- Radius is modest in controls and generous only for large architectural containers.

## Composition and responsive behavior

- Landing sections vary: editorial split, numbered rail, role selector, architectural date composition, payment sequence, support sequence, FAQ and final CTA.
- The landing hero uses the owner-supplied Unsplash image with layered teal overlays and real HTML content. It contains no embedded website screenshot or 3D scene.
- Mobile is composed vertically with shorter line lengths, a complete menu, stacked role selector, one-column dependencies and reachable actions. It is never a cropped desktop canvas.
- Workspaces remain role-specific: organizer readiness/budget/decisions; supplier services/requests/bookings/earnings; crew jobs/timing/evidence/earnings; support assigned cases/evidence/authorized decisions.
- Forms, tables, wallet dialogs and transaction reviews never place decorative imagery behind decision-critical text.

## Motion language

Motion personality is premium and restrained. The standard easing is `cubic-bezier(.22, 1, .36, 1)` with a quick/standard/slow duration palette around 160/280/700ms.

- Hero photography settles once with scale and opacity while the headline remains immediately usable.
- Architectural SVGs carry tiny linear gold dash signals; entire paths never glow.
- Buttons use small lift/press feedback and directional arrow travel. Financial confirmation controls keep stable dimensions.
- Reduced motion removes line travel, entrance motion, smooth scrolling and positional hover changes while retaining color and border feedback.
- Native CSS/SVG is preferred for this bounded motion. GSAP is reserved for a future sequence that genuinely requires timeline coordination; it must use scoped cleanup and transform/opacity animation.

## Product and trust model

- Account sign-in controls identity and database permissions. Wallet access and ownership verification are separate.
- Wallet states distinguish unavailable, approval required, cancelled, wrong network, rejected signature, server failure, timeout, account change, pending, confirmed, reverted and expired.
- “Pay with”, agreement settlement asset and “receive as” are separate concepts.
- Estimated quotes, signed requests, submitted transactions, confirmed ledger results, simulated withdrawals and final released funds are labelled distinctly.
- Test assets have no monetary value. Sandbox withdrawal is a rehearsal, not a bank or anchor payout.
- AI may assist planning, translation and review; it never authorizes payments or resolves fraud/disputes.

## Navigation and interaction

- Public navigation has working How it works, For your role, Sign in, theme and Plan an event destinations.
- Authenticated navigation identifies the current role, validates role switching server-side, shows the active destination, exposes wallet/settings/account/sign-out and preserves safe parent links.
- Fictional demonstrations carry persistent sample-data boundaries and a route back to the authenticated workspace.
- Every enabled action works or explains its prerequisite. Empty and failed queries are distinct.
- Focus is visible, touch targets are at least 44px where practical, dialogs support keyboard use, and content remains usable with enlarged text.

## Role composition

- Organizer: event readiness, budget, decisions, requests, offers, agreements, funding and approval.
- Supplier: services/inventory, relevant requests, offers, bookings, evidence and earnings.
- Crew: skills, shifts, conflicts, preparation countdowns, evidence and earnings.
- Support: assigned cases only, authorized evidence, decision reasons, timestamps and audited actions. A database role alone never authorizes on-chain movement.

## Deferred contract direction: Pactset Go

Pactset Go remains a later bounded contract milestone. It will cover exact versioned bundle terms, authorized participants, funding and expiry checks, and atomic all-or-none activation within an actual transaction boundary. Existing independent escrows do not provide atomic package booking. Earned payments and disputed funds remain protected; organizer-approved replacements require separate funding.
