# Pactset staged implementation plan

> **For agentic workers:** implement this plan task by task and stop at the requested stage boundary. This plan was self-reviewed against `docs/product-spec.md`; it has not received independent human or agent review.

**Goal:** Deliver Pactset in five independently verifiable stages, beginning with a secure, accessible, branded foundation and a real hosted preview.

**Architecture:** A Next.js App Router application with TypeScript, React Server Components by default, narrow client islands for preferences and navigation, and a token-driven CSS design system. Stage 1 contains no live identity, wallet, payment, provider, or ledger functionality. Those integrations arrive behind server-enforced boundaries in later stages.

**Tech stack:** Next.js 16.3.8 Active LTS, React 19.3, TypeScript 5+, Biome, native CSS design tokens, Vitest, Playwright, GitHub, and Vercel. Later stages add persistent hosted data/auth/storage and Rust/Soroban after explicit architecture selection.

**Spec:** `docs/product-spec.md`

## Global constraints

- Stellar Testnet only. Never imply real monetary value, KYC, withdrawals, or production-chain activity.
- Demo data must be fictional and visibly labeled. Never fabricate accounts, balances, payments, providers, ratings, transaction hashes, or integration success.
- Support is assigned, never publicly self-selected.
- Language, named timezone, service area, display preference, and agreement currency remain independent.
- Every requirement remains tracked in `docs/requirements-matrix.md` as not started, fixture only, implemented, verified, or blocked.
- Opal Glass and Obsidian Glass are branded web materials, not claims of an official third-party design system.
- Preserve visible keyboard focus, accessible contrast, reduced-motion behavior, mobile safe areas, and theme stability.
- No credentials, wallet secrets, issuer keys, private keys, or real personal data in source, fixtures, screenshots, or logs.
- A static image or video is never described as working 3D.

## Review focus

1. A visitor can always distinguish fictional demo fixtures from live functionality.
2. Support cannot be selected during public onboarding and role shells do not imply authorization.
3. Theme preference persists without a flash and System follows the OS when no explicit preference exists.
4. Regional controls remain independent and changing preferred currency does not imply mutation of an agreement currency.
5. Narrow mobile layouts keep controls in the viewport, preserve safe areas, and avoid compressed desktop navigation.

## Repository map

- `src/app/`: public landing, onboarding, demo, organizer, supplier, crew, and support routes plus framework states.
- `src/components/`: brand, navigation, theme, preferences, demo disclosure, state previews, and the pavilion-scene boundary.
- `src/lib/`: typed role/navigation/fixture/preference models and pure helpers.
- `src/styles/`: design tokens, materials, layout, components, and reduced-motion/transparency fallbacks.
- `public/`: approved temporary pavilion artwork, original Pactset marks, favicon, and social image.
- `tests/`: unit and browser verification.
- `docs/`: source brief, requirements matrix, this plan, and progress evidence.

## Stage 1: Foundation, design system, tracking, GitHub, and preview

### Task 1: Preserve requirements and repository boundaries

**Files:** `docs/product-spec.md`, `docs/requirements-matrix.md`, `docs/progress.md`, `.gitignore`, `.env.example`, `README.md`

- [x] Copy the supplied brief byte-for-byte into `docs/product-spec.md`.
- [x] Record every requirement with an owner, verification method, stage, and honest status.
- [x] Document that this is a new sibling repository and that the unrelated root and Fieldwork repositories are untouched.
- [x] Verify the staged diff contains no secrets, unrelated files, or downloaded working artifacts.

### Task 2: Scaffold the maintained framework

**Files:** `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `biome.json`, `src/app/layout.tsx`

- [x] Create a Next.js App Router TypeScript application using maintained versions verified against official Next.js and React sources.
- [x] Add explicit `typecheck`, `lint`, `test`, `test:e2e`, and `build` scripts.
- [x] Configure conservative security headers that remain compatible with the static Stage 1 surface.
- [x] Confirm `npm ci`, typecheck, lint, unit tests, and a production build pass.

### Task 3: Build the Pactset design foundation

**Files:** `src/app/globals.css`, `src/components/brand/*`, `src/components/theme/*`, `public/favicon.svg`, `public/pactset-mark.svg`

- [x] Define Opal and Obsidian semantic tokens for atmosphere, ink, text, glass, edges, shadows, indigo/periwinkle actions, focus, error, warning, and success.
- [x] Implement Light, Dark, and System preferences with an early theme script, persistent local preference, and system-change handling.
- [x] Add original Pactset mark/wordmark/favicons and wide editorial sans typography through a self-hosted variable font package.
- [x] Implement focus-visible, hover, active, disabled, loading, empty, error, and reduced-motion/reduced-transparency states.
- [x] Run the design/taste pre-flight and record exceptions in `docs/progress.md`.

### Task 4: Build the public landing and pavilion boundary

**Files:** `src/app/page.tsx`, `src/components/landing/*`, `src/components/pavilion/pavilion-scene.tsx`, `public/images/pavilion-temporary.webp`

- [x] Render “Every detail. One shared plan.” with “Plan an event” and “Explore the demo” immediately usable.
- [x] Use the approved pavilion artwork as a visibly labeled temporary fallback.
- [x] Reserve a stable `PavilionScene` boundary for Stage 5 without loading a 3D dependency in Stage 1.
- [x] Explain Pactset and Stellar Testnet honestly, without testimonials, vendor logos, counters, or security guarantees.
- [x] Link every primary action to a real route or an explicit unavailable explanation.

### Task 5: Build onboarding, role shells, preferences, and demo

**Files:** `src/app/onboarding/page.tsx`, `src/app/demo/page.tsx`, `src/app/(roles)/**`, `src/components/shell/*`, `src/components/preferences/*`, `src/lib/fixtures.ts`

- [x] Offer Organizer, Supplier, and Crew during public onboarding; explain that Support access is assigned.
- [x] Build distinct organizer, supplier, crew, and support shells with role-specific navigation and mobile-safe navigation.
- [x] Add independent service area, language, named timezone, and preferred test currency controls (TUSD, TGBP, TAUD).
- [x] Persist non-sensitive preferences locally and state that they do not change an existing agreement’s currency.
- [x] Provide an explicit demo path using named fictional fixtures and honest unavailable-action states.

### Task 6: Verify, publish, and verify again

**Files:** `tests/**/*.test.ts`, `tests/e2e/**/*.spec.ts`, `docs/progress.md`

- [x] Run build, typecheck, lint, tests, dependency audit, secret scan, and diff review.
- [x] Browser-check desktop and 375px mobile in light and dark themes, navigation, preference persistence, dropdown contrast, keyboard focus, and demo separation.
- [x] Capture four evidence screenshots: light desktop, dark desktop, light mobile, dark mobile.
- [x] Create a new private `miracle352/Pactset` repository only after confirming it does not exist; commit and push without force.
- [ ] Create/link a new Vercel project, deploy the pushed milestone, open the actual deployment URL, and repeat the browser smoke checks.
- [x] Record the pushed commit, repository URL, exact checks, screenshots, and deployment blocker without inventing a URL.

## Stage 2: Persistent booking and real Testnet settlement

- [ ] Select and document persistent auth/database/storage architecture and role enforcement.
- [ ] Implement separate-role accounts and one complete persistent booking flow.
- [ ] Implement the issued-asset registry, trustlines, controlled Testnet distribution/liquidity, quote/convert flow, and explicit failure recovery.
- [ ] Implement versioned Soroban escrow with exact-unit arithmetic, idempotency, server-side validation, wallet-bound authorization, and ledger reconciliation.
- [ ] Prove recipient-confirmed milestone release across separate browser sessions and record real explorer evidence.

## Stage 3: Planning, readiness, evidence, changes, and replacement

- [ ] Implement structured planning intake, editable budgets, quote/commit/fund/pay accounting, offers, counteroffers, and capacity reservations.
- [ ] Implement distinct venue/rental/purchase terms, deadlines, countdowns, deterministic readiness, and accepted extensions.
- [ ] Implement private resumable evidence uploads and separate upload, AI-assessment, approval, and release states.
- [ ] Implement versioned change requests with impacted-party acceptance and extra funding gates.
- [ ] Implement replacement discovery/invitation/booking while resolving the original agreement separately.

## Stage 4: Communication, assistance, cancellation, support, and reputation

- [ ] Implement participant chat, attachment controls, language detection, originals, translations, delivery states, and manual overrides.
- [ ] Add permission-validated tagged AI assistance that cannot send commitments or move money without approval.
- [ ] Add assigned support cases, disclosed access, private/joint conversations, nonresponse escalation, and bounded adjudication.
- [ ] Add cancellation, potential off-platform review flags, immutable audit records, disputes, and wage-dispute handling.
- [ ] Add participant-only reviews, provider responses, private declines, and reviewed/appealable abandonment allegations.

## Stage 5: Interactive pavilion, refinement, rehearsal, and hardening

- [ ] Replace the temporary artwork with a lazy-loaded real 3D pavilion with clear glass, metal ribs, stage, seating, shadows, and lighting.
- [ ] Verify a gentle pavilion entrance while headline and buttons are immediately interactive and visually stable.
- [ ] Verify real 3D depth with subtle spring-smoothed cursor-responsive camera movement.
- [ ] Verify a smooth daylight-to-evening lighting transition when changing themes.
- [ ] Verify scroll progression that introduces venue, crew, and payment milestones without blocking normal page use.
- [ ] Verify renderer pause/offscreen behavior, capped effort, lightweight mobile mode, and static/reduced-motion fallbacks.
- [ ] Complete mobile, accessibility, performance, offline/slow-state, solo lab, separate-session, adversarial, and live-demo rehearsals.
- [ ] Harden deployment, reconciliation workers, scheduling/notifications, monitoring, and submission documentation.

## Plan self-review record

- Spec coverage: mapped across all five stages; detailed row-level coverage lives in `docs/requirements-matrix.md`.
- Step scan: Stage 1 tasks have concrete files, outcomes, and commands; later stages remain scoped epics intentionally.
- Type consistency: Stage 1 uses fixture-only typed models and does not define premature backend contracts.
- Review focus: the five highest-risk Stage 1 failures are assigned browser or unit verification.
- Proportion: the plan is shorter than the source brief and preserves rather than re-specifies later behavior.
- Independent review: not performed.
