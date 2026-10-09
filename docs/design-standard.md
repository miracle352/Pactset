# Pactset design standard

Status: approved dark-only architectural event-operations direction, 9 October 2026. `MASTER.md` is the token and component-state source of truth.

## Current visual authority

The owner's 2026-10-09 brief is the primary visual direction. Its supplied reference is a source for color, typography, cinematic image treatment, architectural lines, gold signal motion, arrow controls and footer structure—not literal content or a two-section template.

The previous pavilion/3D-building and light-theme directions are retired. They must not be mounted, combined with this system, or represented as current roadmap work. The active product uses dark editorial photography, SVG architecture and practical product surfaces.

## Creative thesis

Pactset is an event blueprint in motion. Fine architectural lines represent dependencies among venue, suppliers, crew, evidence and payment. Small gold signals identify a decision or responsibility moving through that plan. The signal is illustrative navigation language, never a claim that work or money is confirmed.

The public experience is cinematic and editorial. Authenticated work is quieter, denser and operational. Financial pages prioritize exact amounts, assets, participants and state over spectacle.

## Visual tokens

- Deep teal `#061f1e`: primary dark ground and high-trust financial context.
- Dark green `#103f3c`: secondary dark sections, framing and footer surfaces.
- Gold `#dfa12d`: decisions, controlled emphasis, current step and traveling line signals.
- Off-white `#f3f5ef`: foreground on the dark system.
- Pactset is dark-only. Stored theme preferences and operating-system light mode cannot change the initial or hydrated rendering.
- Typography uses Inter/system sans-serif. Georgia/Times italic is reserved for selected editorial emphasis such as “One seamless experience,” never routine labels or numbers.
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
- Native CSS/SVG handles structural line signals and the hero settle. GSAP coordinates the one-time landing reveals and interactive preparation timeline; Lenis is limited to the public landing page. Both are cleaned up on navigation, leave content visible before initialization, and are disabled or flattened for reduced motion.

## Product and trust model

- Account sign-in controls identity and database permissions. Wallet access and ownership verification are separate.
- Wallet states distinguish unavailable, approval required, cancelled, wrong network, rejected signature, server failure, timeout, account change, pending, confirmed, reverted and expired.
- “Pay with”, agreement settlement asset and “receive as” are separate concepts.
- Estimated quotes, signed requests, submitted transactions, confirmed ledger results, simulated withdrawals and final released funds are labelled distinctly.
- Test assets have no monetary value. Sandbox withdrawal is a rehearsal, not a bank or anchor payout.
- AI may assist planning, translation and review; it never authorizes payments or resolves fraud/disputes.

## Navigation and interaction

- Public navigation has working How it works, For organizers, For suppliers & crew, Payments, Sign in/Open workspace and Plan an event destinations. Plan an event preserves the event-creation destination through authentication; Find work preserves the selected supplier or crew opportunity destination. Demo tools remain isolated and do not compete in the main journey.
- Authenticated navigation identifies the current role, validates role switching server-side, shows the active destination, exposes wallet/settings/account/sign-out and preserves safe parent links.
- Fictional demonstrations carry persistent sample-data boundaries and a route back to the authenticated workspace.
- Every enabled action works or explains its prerequisite. Empty and failed queries are distinct.
- Focus is visible, touch targets are at least 44px where practical, dialogs support keyboard use, and content remains usable with enlarged text.

## Role composition

- Organizer: event readiness, budget, decisions, requests, offers, agreements, funding and approval.
- Supplier: services/inventory, relevant requests, offers, bookings, evidence and earnings.
- Crew: skills, shifts, conflicts, preparation countdowns, evidence and earnings.
- Support: assigned cases only, authorized evidence, decision reasons, timestamps and audited actions. A database role alone never authorizes on-chain movement.

## Pactset Go boundary

Pactset Go is implemented locally as a bounded Stellar Testnet bundle contract and event workflow. It covers exact versioned bundle terms, authorized participants, funding and expiry checks, and atomic all-or-none activation within one Soroban transaction boundary. Existing independent escrows still do not provide atomic package booking. Earned payments and disputed funds remain protected; organizer-approved replacements require separate funding. The uploaded WASM and automated contract tests are not evidence that a fresh browser-signed bundle instance or multi-account Freighter rehearsal has passed; the interface must retain that honest distinction.
