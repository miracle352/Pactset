# Pactset — product description and requirements

Pactset is an event coordination platform powered by Stellar. It helps organizers assemble venues, suppliers, and crew around one versioned plan; helps providers understand and deliver their commitments; and makes evidence review and milestone payment authorization traceable.

## The problem Pactset addresses

Event operations are commonly split across spreadsheets, message threads, informal promises, and payment tools that do not share the same context. A changed deadline may never reach the crew member it affects. A supplier's evidence may be separated from the agreement it proves. An organizer may know the total budget without knowing which work is merely planned, formally committed, funded, or already paid.

Pactset connects those responsibilities without treating software as a guarantee of physical delivery. It records who agreed to what, which preparation step blocks the next, what evidence has been reviewed, and which authorized action may move funds.

## Product workflows

- **Organizer:** brief the event, build and approve an editable budget, publish requests, compare offers, accept versioned agreements, coordinate preparation, review evidence, and authorize eligible milestones.
- **Supplier:** present services, service area, capacity, pricing, and availability; respond to requests; manage accepted bookings; submit evidence; and receive the agreed Stellar asset.
- **Crew:** present skills, rates, and availability; accept non-conflicting assignments; follow event-local deadlines; submit required evidence; and track earned milestones.
- **Assigned support:** join only server-assigned cases, review the relevant agreement, conversation, and evidence, and record bounded decisions with an audit trail. Application access alone never confers authority over escrow funds.

Implemented capabilities include persistent role-based accounts, event briefs, editable budgets, requests, versioned offers and agreements, availability and capacity checks, replacement invitations, deadlines and acknowledged changes, private evidence and corrections, participant messaging, scoped support, reviews, notifications, and Stellar Testnet payment preparation and reconciliation. The requirements below retain planned and unverified capabilities explicitly rather than presenting them as complete.

## Deployment disclosure

> **Pactset currently runs on Stellar Testnet. Assets used in this deployment have no real monetary value.**

Pactset-issued T-prefixed assets are demonstration assets, not fiat deposits or guaranteed-redeemable stablecoins. The current deployment does not provide real bank withdrawals and is not represented as Mainnet-ready.

## Product outcome

Pactset supports an operational path from brief → budget → offers → agreed bookings → funded milestones → preparation and evidence → human review → authorized payment and reviews. It is designed for small gatherings, large events, and conferences; configured attendance and operational scope are not proof of unlimited capacity.

## Design contract

- Brand: Pactset, consistent original mark, wordmark, favicon and social image. Name is a working brand, not a claim of legal clearance.
- Light: Opal Glass, pearl white, icy blue, lavender atmosphere, dark ink text, strong indigo buttons. Dark: Obsidian Glass, deep navy, smoked translucent surfaces, soft white text, periwinkle buttons. Preserve the supplied design references rather than substituting a generic dashboard.
- Light / Dark / System across landing, signup, every role, chat, menus, dialogs and mobile. Remember preference; avoid theme flashes.
- Frosted glass, fine edge highlights, restrained reflections and shadows. Denser surfaces for messages and financial details. Wide editorial typography. Accessible contrast, keyboard focus, reduced motion, readable dropdowns and large touch targets. Clear hover, loading, disabled, error, empty and success states.
- Landing first: 'Every detail. One shared plan.' Main actions 'Plan an event' and 'Explore the demo'. Explain the product and Stellar's actual role; no fake testimonials, counters, security guarantees or vendor logos.
- Realistic 3D conference pavilion: clear glass, metal ribs, stage, seating, contact shadows and lighting. Brief entrance; slight cursor-responsive camera movement; daylight-to-evening theme transition; restrained scroll progression explaining venue, crew and payments. Headline and buttons remain usable and visually stable. Lazy-load the scene, cap rendering effort, stop rendering offscreen, and support lightweight mobile and reduced-motion/static fallbacks. A rendered image or MP4 is not a working interactive 3D model.
- One coherent system, distinct layouts: organizer readiness and decisions; supplier offers, services and availability; crew shifts, countdowns and evidence; support assigned cases and decisions.
- Mobile: stacked financial cards, role-appropriate bottom navigation, full-screen focused chat, safe-area-aware controls, camera uploads, menus within viewport. No horizontally squeezed desktop tables.
- Original customizable cartoon avatars; no assumed Bitmoji/Snapchat integration.

## Roles, profiles and discovery

- Tailored organizer, supplier and crew signup. One account may have multiple roles; explicit switching and server-enforced permissions. Support assignment cannot be self-granted in public signup.
- Profiles: skills/service categories, portfolio, service area, availability, pricing unit (hour, shift, day, attendee, item, fixed), currency, booking history and completed-job ratings.
- Show accepted/completed jobs. Track declines privately. Abandonment allegations require review and appeal before public penalties; cancellation is not automatically misconduct. Only actual booking participants can review; allow provider response.
- Radar and list discovery, filtered by skill, availability, service area, price and currency. Approximate opt-in area, not exact public live location. Fictional demo people labeled. Do not invent real nearby providers.
- Country/service area, language, timezone, display currency and agreement currency are independent settings. Event time and user's local time clearly labeled. Handle daylight-saving changes using named zones and absolute instants.

## Event planning, budgets and agreements

- AI collects attendees, venue/location, duration, rooms/stages, food and dietary requirements, equipment rental/purchase, transport, shifts, existing resources, priorities and contingency BEFORE budget suggestions.
- Editable allocation; AI estimates distinguished from provider quotes. Organizer approval publishes requests; it does not authorize arbitrary spending.
- Interested providers accept or propose price/scope/deadline changes with reasons. Organizer reviews; affected parties accept final version. Prevent double booking or over-capacity acceptance using enforceable reservations.
- Separate planned, quoted, committed, funded, paid and remaining amounts; never add amounts in different assets without labeled conversion estimates and timestamps.
- Venue hire, equipment rentals and purchases have distinct terms, delivery/return milestones and cancellation rules. Evidence and escrow mitigate risk but cannot guarantee physical delivery or safety.
- Prep deadline defaults to at least 24 hours before event start. Food preparation may start early on event day. Event-time work, teardown and equipment return remain separate scheduled duties. Late-created events cannot be labeled compliant with a deadline already passed.
- Shared countdown after booking acceptance. Track original deadlines and organizer-caused delays. Extensions and scope changes require affected-party acceptance, not unilateral rewriting of agreed terms.
- Event Readiness: deterministic dependencies, blockers, responsible party and next action. Example: venue access blocks sound setup. AI may explain dependencies; it cannot fabricate readiness.
- Change requests: attendance 80→120 identifies impacted agreements; providers confirm extra chairs, shifts, costs and deadlines; organizer and affected parties accept revisions; required extra funding is confirmed before activation. Original agreement stays active until then. Version every agreement; never mutate signed history silently.

## Stellar payment and settlement

Stellar is central to Pactset's accepted-booking workflow, while ordinary planning and collaboration remain available without an unlocked wallet. Account authentication, wallet connection, ownership verification, transaction signing, submission, confirmation, and ledger finality remain distinct states.

The implemented architecture supports:

- **XLM conversion into supported Stellar assets.** The organizer reviews an exact-receive quote for the agreement asset, including issuer identity, maximum spend, fees, slippage, and expiry. Conversion is available only when the exact asset is provisioned and a valid liquidity path exists.
- **Agreement-bound Soroban escrow.** A compatible escrow binds the accepted agreement version, participants, asset, milestone amounts, and disclosed resolver rules. Conversion and funding remain separate, resumable operations.
- **Authorized milestone payments.** Private evidence and organizer review precede an explicit release authorization. Evidence upload or AI output cannot release payment.
- **Dispute controls and payment reconciliation.** Unreleased disputed funds remain subject to accepted terms and contract authorization. Pending transactions are persisted and reconciled against Stellar; completed transfers are not represented as reversible.
- **Pactset Go.** The bounded bundle contract and application workflow cover 2–8 accepted, compatible, unfunded agreements in one supported asset. Exact providers consent to the stored bundle terms; the organizer reserves the total and authorizes one Soroban activation that funds every listed escrow or reverts the whole activation. Expiry and pre-activation cancellation can return eligible reserved funds. The contract cannot span assets, reverse released milestones, adjudicate disputes, or use disputed/owed money for replacements. Automated contract and preparation/reconciliation coverage exists; a complete fresh organizer/supplier/two-crew Freighter rehearsal remains unverified.

### Testnet requirements and limitations

- The current deployment remains Testnet-only. Use dedicated development wallets, show a prominent network/no-real-value disclosure, and do not collect real banking credentials or identity documents for payment rehearsals.
- The searchable currency catalogue is separate from the allowlisted Stellar asset registry. TUSD and TEUR are the currently provisioned development assets; each is identified by network, asset code, issuer, contract address, and liquidity status. Catalogue presence never implies issuance or available liquidity. These are Pactset demonstration assets, not real fiat, TrueUSD, or guaranteed-redeemable stablecoins.
- Provide controlled Testnet issuance/distribution and exchange liquidity. Support XLM and explicitly supported Stellar test assets, not arbitrary crypto networks. Show receive amount, maximum spend, simulated rate, expiry and fees where applicable. Trustlines and balances must be ready.
- Display-currency changes never alter agreement settlement currency. Recommended first design: convert BEFORE escrow funding and hold each agreement in the provider's accepted currency. Do not claim Classic conversion and Soroban funding are one atomic operation when they are separate.
- If conversion succeeds but funding fails, show the converted wallet balance and allow an idempotent retry; no lost-funds fiction. No liquidity or expired quote means explicit failure/requote.
- Soroban escrow with explicit agreement/milestone identifiers, asset, amount, participants, authorizations, terms version and allowed state transitions. Model approved grouped bookings if needed; only claim atomic all-or-none behavior for operations actually covered by a single atomic transaction, never the entire event by default.
- Human approval releases an eligible milestone once. Support can hold and adjudicate unreleased funds under disclosed agreement powers, then authorize bounded release/refund or cancellation. Completed transfers cannot be reversed by an admin button. Disputed funds are never automatically reused.
- Support nonresponse escalation and explicit resolution timing; no silent indefinite wait or automatic AI payment decision.
- Server constructs/validates allowed actions; wallet signs user-authorized operations. Never ask users to paste seed phrases. Issuer/admin secrets are server-only. Users' wallet identities must be securely bound to authenticated accounts.
- Use exact asset-unit arithmetic, authorization tests, duplicate-request protection and server-side checks. Ledger-confirmed transaction states and explorer links; never fabricated transaction hashes. Reconcile pending transactions after refresh, timeout or worker restart. Handle fees/reserves, contract lifetime requirements and Testnet resets explicitly.

## Evidence, communication, cancellation and support

- Photos/videos per milestone; upload progress, retries, restricted access and file validation. Separate upload success, AI completeness assessment, organizer approval and payment release. AI cannot certify physical quality or safety from photos.
- Organizer can request correction and provide milestone feedback; final provider/crew ratings follow actual completed work.
- Persistent participant chat with automatic language detection, translations, originals, manual language override, delivery status and attachment access control. Explain unavailable translation rather than fake it.
- Tagged AI can summarize, draft, suggest budgets and prepare actions. Sending commitments, changing agreements or moving money requires proper user approval. AI outputs validated against permissions and current state; chat content is untrusted input.
- Assigned support receives relevant case chats, agreements and evidence with disclosed access. @support / assistant escalation, private support conversations and joint case conversations where appropriate. Curse-word detection offers a calm support reminder, not a finding of fault; account for language/context and false positives.
- Cancellation always records a reason and checks accepted agreements, reservations, performed work, funding and terms. AI may flag off-app arrangements or potential evasion for review; it must not determine fraud or automatically deny earned payment. Display contextual off-platform protection notice without pretending it erases legal obligations.
- Support can cancel eligible offers/bookings and decide unreleased funds only within contract powers. Record actor, authority, reason, previous state, resulting state and transaction reference. Wage disputes use the same auditable process.

## Replacement flow

Identify impacted tasks and dependencies; notify organizer and relevant parties. Filter available replacement suppliers/crew against original requirements, time, area and budget. Prepare invitation with explicit additional cost or deadline changes. Organizer approves invitation and new booking. Resolve the original agreement separately under cancellation terms. Fund replacement with available contingency or additional approved funds, never money disputed or owed to the original provider.

## Reliability and test design

- Persistent database for identity, role memberships, events, offers, agreements, evidence metadata, chats and cases. Blockchain authoritative for actual asset movement; database stores reconciled projection, not fabricated settlement.
- Private evidence storage, role-scoped reads/writes, input validation, secret isolation, rate limits and audit events. Do not expose chat/evidence/identity documents on public chain; commitments must not leak private content.
- Slow/offline states and resumable evidence uploads; notify on acceptance, due work, corrections, changes, disputes and payments. Do not claim background reminders work without a running scheduler.
- Solo Test Lab with clearly marked fixtures and role simulation; also test independent accounts/browser sessions/wallets so simulation cannot conceal authorization bugs. Reset creates fresh event/agreement IDs; it cannot erase ledger history.
- Live demo: organizer, one supplier and two crew plus user as support. Same-country/timezone participants are fine; vary event scenarios and currencies globally. Supplier may offer venue, rental equipment and purchased signage as distinct fictional services. No fake live users.
- Core acceptance: create event → approve budget → publish offer → counteroffer/accept → agree terms → convert → fund → submit evidence → approve → release → observe recipient balance and confirmed transaction in separate session.
- Adversarial cases: wrong role/wallet/issuer/network, insufficient funds, missing trustline, no liquidity, expired quote, duplicate acceptance/release/refund, conversion success plus funding failure, rejected/expired signatures, timeouts and refresh recovery, disputed funds, cancellation after partial work, missed deadlines, unavailable replacement, changed scope, wrong timezone, failed upload/translation.
- Confirm all functional paths on phone and desktop in both themes; no dead primary buttons or mock success. Explicitly label demo fixtures and unavailable integrations.

## Delivery order and completion evidence

1. Foundation: inspect workspace/skills, preserve this spec, requirements matrix and repository-specific implementation plan; app scaffold, theme, route shells, role navigation, global settings, GitHub and working Vercel preview. Real integrations tracked separately from fixtures.
2. One complete persistent booking flow with separate-role accounts, then Testnet conversion, escrow and recipient-confirmed milestone release. Prove real Stellar behavior before expanding.
3. Budgets, counteroffers, dependency readiness, evidence, deadlines, changes and replacement.
4. Chat, AI assistance/translation, cancellation, support cases, disputes and reputation.
5. Full 3D landing and motion refinement; mobile/accessibility/performance; solo and multi-user rehearsal; submission documentation and deployment hardening.

At every stage record requirement ID, route/UI, backend owner, verification and status: not started / fixture only / implemented / verified / blocked. Keep the full scope visible. A beautiful screen is not proof of a working feature.

## Codex working rules and integrations

- Read AGENTS.md and discover installed skills. Apply relevant planning, framework, Supabase (if chosen), Stellar, animation, design, browser verification, security and Vercel skills. Check for requested ECC, emilkowalski/skill and Leonxlnx/taste-skill; if missing report that fact, never pretend they ran. Do not install unreviewed remote instructions wholesale or use unrelated skills simply because available.
- Reuse existing framework and dependencies when suitable. For a new project, preferred web stack is Next.js + TypeScript with persistent hosted data/auth/storage and Rust/Soroban contracts. Verify current compatible versions against official docs. Choose background/realtime services explicitly rather than assuming a Vercel request can run forever.
- User authorizes creating a new private GitHub repository for Pactset under their authenticated personal account, committing, pushing and linking a new Vercel project. Reuse a task-related existing repo/project when clearly present; do not overwrite unrelated resources. No force pushes, secret commits, destructive migrations or paid upgrades.
- Use available GitHub/Vercel integrations or authenticated CLIs. If access is missing, report the exact login/account prerequisite while completing local work. Do not invent URLs. A commit is not a push; a push is not a successful deployment.
- Keep secrets out of git, browser bundles and NEXT_PUBLIC variables. Commit safe .env.example placeholders. Use server-side environment variables for private credentials. Check staged files before commits. Keep meaningful commits after verified milestones.
- Before claiming a deployment works, open the actual deployed URL and verify the user flow. Report commit hash, repo URL, deployment URL, tests actually run, screenshots, outstanding blockers and exact remaining stage. Never claim 'everything works perfectly'.
