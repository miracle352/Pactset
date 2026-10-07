# Pactset design standard

Status: approved product direction, October 2026. This document makes the task-level Personal Web3 and DeFi Design Standard durable and applies it specifically to Pactset.

## Creative thesis

Pactset is an illuminated pavilion: many independent rooms, people, deadlines, and payments become one legible shared structure. The venue is the central visual object. Warm interior light represents accountable work moving from plan to release; it must never be used to imply that an unconfirmed payment or incomplete task is ready.

The public story is cinematic and architectural. Authenticated work is calmer, denser, and operational. The product must not look like a generic SaaS dashboard or stereotypical neon crypto interface.

## Visual system

- Dark mode begins with deep black and smoked navy, warm architectural light, restrained indigo/periwinkle signals, opal reflections, and readable near-white type.
- Light mode is the same world in pearl daylight: cool white surfaces, quiet lavender/icy-blue reflections, dark ink, and solid financial panels.
- Display typography is wide and editorial with deliberate line breaks. Interface and numeric type stay compact and highly readable.
- Landing composition may be spacious; operational pages use tighter rhythm and role-specific hierarchy. Financial information uses dense, solid-backed surfaces inside the glass system.
- Glass communicates enclosure and layering. It is not a decorative effect for every card. Avoid interchangeable card grids, glowing spheres, random crypto imagery, and excessive purple gradients.
- Controls use stable dimensions, visible focus, generous touch targets, and semantic status color. Back/navigation controls keep an always-visible arrow, raised edge, hover lift, pressed depth, and reduced-motion color-only feedback.

## Landing narrative and motion

The real interactive pavilion is a progressively enhanced Three.js scene, never a screenshot of a website. It must use real scene lights and reflective materials so the warm interior visibly affects the floor, glass, and metal.

1. Introduce the venue with a gentle entrance while the headline and actions are immediately usable.
2. Reveal venue, equipment, and crew dependencies.
3. Assemble essential bookings into one shared plan.
4. Trace preparation, evidence, approval, and Testnet payment without presenting illustrative light as live state.

Pointer depth is restrained; there is no continuous toy-like spin or scroll hijacking. Theme changes transition scene lighting from pearl daylight to warm evening. Mobile gets portrait framing and a shorter narrative. Reduced motion, slow devices, and missing WebGL receive a polished static pavilion fallback. Rendering pauses offscreen and device pixel ratio is capped.

## Product and trust model

- Account sign-in controls identity and database permissions. Wallet access and ownership verification are separate.
- Wallet states distinguish unavailable, approval required, cancelled, wrong network, rejected signature, server failure, timeout, account change, pending, confirmed, reverted, and expired.
- “Pay with”, agreement settlement asset, and “receive as” are separate concepts.
- Estimated quotes, signed requests, submitted transactions, confirmed ledger results, simulated withdrawals, and final released funds are labelled distinctly.
- Test assets have no monetary value. Sandbox withdrawal is a rehearsal, not a bank or anchor payout.
- AI may assist planning, translation, and review; it never authorizes payments or resolves fraud/disputes.

## Role composition

- Organizer: readiness, budget, decisions, requests, offers, agreements, funding, and approval.
- Supplier: services/inventory, relevant requests, offers, bookings, evidence, and earnings.
- Crew: skills, shifts, schedule conflicts, preparation countdowns, evidence, and earnings.
- Support: assigned cases only, authorized evidence, decision reasons, timestamps, and audited actions. A database role alone never authorizes on-chain movement.

## Responsive and accessibility rules

Mobile is an intentional composition, not a cropped desktop view. Every destination remains reachable through compact primary navigation plus More. All interactive UI supports keyboard use, visible focus, Escape and focus return for dialogs, enlarged text, reduced motion, and at least 44px touch targets. No essential information or action is hover-only.

## Deferred contract direction: Pactset Go

Pactset Go is the next bounded contract milestone after the repaired wallet/payment journey. It will cover exact versioned bundle terms, authorized participants, funding and expiry checks, and atomic all-or-none activation within an actual transaction boundary. Existing independent escrows do not provide atomic package booking. Earned payments and disputed funds remain protected; organizer-approved replacements require separate funding.
