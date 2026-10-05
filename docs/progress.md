# Pactset progress

## 2026-10-05 — Stage 2B local Testnet checkpoint

- Added a runtime ISO 4217 test-currency catalogue and a separate provisioned Stellar Testnet asset registry.
- Provisioned TUSD and TEUR through one generic idempotent process with real trustlines, issued test supply, illustrative seeded liquidity, and SAC addresses.
- Deployed a version-bound Soroban escrow and completed one genuine XLM → TUSD → escrow → submit → release journey; the supplier received exactly 750 TUSD.
- Verified expiring single-use wallet ownership challenges, replay/wrong-network/cross-account rejection, private evidence ACL, repeated/unauthorized/disputed release rejection, and an authorized resolver refund.
- Added a responsive participant-only payment projection with real explorer links and light/dark desktop/mobile screenshots.
- Browser transaction signing, automatic reconciliation, the remaining failure matrix, and evidence/review actions remain incomplete and are labeled as such. No push or deployment was performed.

Last updated: 2026-10-05 (Africa/Lagos)

## Current stage

Stage 2A remains complete except for real email-link confirmation and recovery, which are still blocked by the hosted email limit. Stage 2B has a genuine local/operator-driven Testnet settlement proof and participant payment projection, but browser-signed payment actions, automatic reconciliation, and several adversarial cases remain incomplete. Later stages remain out of scope.

## Stage 2A inspection and architecture record

- The existing repository, routes, Opal/Obsidian tokens, theme persistence, GitHub remote, and Vercel project are being preserved.
- The current public role pages are fictional generic shells with broken hash navigation, oversized headings, repeated local preferences, and a component-state showcase. These findings are now explicit `REV-*` requirements.
- Supabase is the selected managed Auth/Postgres service. The existing `pactset-development` project (`lvpsemqalftvcqkrjsyu`) was verified in “miracle352’s projects” through the connection labeled `python`. Fieldwork and `supabase-canary-branch` were not changed.
- Current official Supabase guidance was checked on 2026-10-04. The implementation uses publishable keys, `@supabase/ssr`, cookie sessions, Next.js 16 `proxy.ts`, `getClaims()` for server identity checks, explicit Data API grants, and RLS on every exposed table.
- Changelog review found the 2026 Data API auto-exposure change and the move toward publishable keys; migrations therefore include explicit least-privilege grants rather than assuming new tables are exposed.
- Design read: targeted evolution of the existing premium event brand. Dials are `DESIGN_VARIANCE 5`, `MOTION_INTENSITY 3`, and `VISUAL_DENSITY 6`. The glass system stays; workspace type becomes compact; role layouts become task-specific; animation is limited to feedback.

## Inspection record

- Workspace root is an existing personal profile repository (`miracle352/miracle352`) with an unrelated untracked nested `fieldwork/` repository. Pactset is being created in a separate sibling folder and repository at `pactset/`.
- No repository `AGENTS.md` existed at initial inspection. Next.js later generated its version-specific `AGENTS.md` and `CLAUDE.md`; the proxy guidance it requires was read from the installed Next.js 16 documentation before further edits.

## Stage 2A local implementation checkpoint

- Implemented Supabase SSR auth screens/actions, verification and recovery callbacks, session refresh proxy, protected layouts, multiple public roles, and a server-assigned-only support boundary.
- Added profile/settings persistence contracts, an original CSS avatar, global country/language/IANA timezone controls, independent test-currency preferences, provider services/skills/pricing/availability, and supplier inventory.
- Added organizer draft events with named event timezones, validated local-to-instant conversion, 24-hour preparation defaults, capacity/budget/quantity validation, explicit save states, request publication, provider offers, versioned counteroffers, rejection/withdrawal, two-party acceptance, and visibly unfunded agreements.
- The migration enables RLS on every exposed table, revokes anonymous table access, derives identity from `auth.uid()`, serializes provider capacity checks, rejects stale versions, resets expired acceptance, prevents duplicate agreements, audits transitions, and checks overlapping supplier inventory or crew shifts.
- Public role demos remain fictional and separate from `/workspace/*`. The public component-state showcase and remaining milestone/development copy were removed.
- Local verification passed: typecheck, Biome lint, 6 Node tests, production build, dependency audit with zero vulnerabilities, and 23 Playwright browser checks with 3 expected device-specific skips. Public/auth routes, themes, mobile widths, focus, touch, reduced motion, navigation, and overflow were exercised.
- The Stage 2A schema and hardening migration are applied to `pactset-development`. Data API is enabled, automatic table exposure is off, automatic RLS is enabled, all 11 application tables have RLS, anonymous table grants are absent, and authenticated access is explicitly granted.
- Four dashboard-created, auto-confirmed development-only users are recorded in an ignored local state file. A real separate-account run passed 12/12 checks: organizer login/logout and draft resume, privacy-safe request discovery, idempotent supplier offer retry, stale-version rejection, concurrent same-version acceptance, unfunded supplier and crew agreements, unrelated-account read/update denial, support self-assignment denial, and agreement persistence after signing in again.
- Focused remote edge-case verification passed 7/7 checks: supplier inventory overbooking rejected, crew scheduling conflict rejected, organizer rejection persisted, provider withdrawal persisted, a first acceptance created a temporary reservation, forced expiry cleared the stale acceptance, and a fresh two-party acceptance released the reservation into an unfunded agreement.
- Authenticated Playwright journeys passed on desktop and mobile for organizer, supplier, and crew. Visual inspection covered light/dark full-page evidence. It exposed and fixed the organizer's nonexistent offer-detail target and the missing mobile account/sign-out control while preserving the Opal/Obsidian glass system.
- The final Next.js production build passed after those fixes. No deployment or hosted verification was attempted.
- Normal email confirmation remains enabled globally. Real confirmation-link and password-recovery email flows are still blocked/unverified because the Free-plan email service rate limit was reached; dashboard auto-confirm was used only for the four development test identities.
- Payment-phase requirement `PAY-015` preserves broad local test-currency selection as a catalog separate from Stellar assets actually provisioned for Testnet settlement. It is not implemented in Stage 2A.
- Per the user’s latest instruction, no production deployment was attempted and no commit was pushed, because pushing `main` would trigger the existing production-linked Vercel project.
- GitHub is authenticated as personal account `miracle352`. Search found no existing personal Pactset repository, so a new private repository was created at `https://github.com/miracle352/Pactset` and the verified `main` history was pushed without force.
- Vercel's connector remains independently unauthorized for the `miracle352` account scope. The signed-in browser route could access the exact private `miracle352/Pactset` repository without another identity challenge, so it was used to create the single `pactset` project and deploy `https://pactset.vercel.app` without changing repository visibility or security settings.
- Official framework check on 2026-10-04: Next.js 16.3.8 is Active LTS, React 19.3 is stable, Next.js 16 requires Node.js 20.9+ and TypeScript 5.1+.

## Skill audit

| Capability | Evidence | Use in Stage 1 |
| --- | --- | --- |
| ECC | Installed (`ecc` 2.2.3) | Browser QA, security review, motion foundations, verification loop |
| emilkowalski/skill | Installed as local `emil-design-eng`; frontmatter explicitly attributes Emil Kowalski’s design-engineering philosophy | Interaction polish and motion review |
| Leonxlnx/taste-skill | A local `design-taste-frontend` / `tasteskill` is installed, but its files do not carry verifiable Leonxlnx package metadata | Applied for anti-template design and pre-flight; exact upstream attribution remains unverified |
| Planning | `writing-plans` installed | Repository-specific five-stage plan and self-review |
| Next.js / React | Vercel `nextjs` and `react-best-practices` installed | App Router, RSC/client boundary, image/font/performance review |
| Browser verification | ECC `browser-qa` and bundled computer-use installed | Local and hosted responsive/theme/navigation verification |
| Security | ECC `security-review` installed | Secret handling, headers, dependency audit, staged diff scan |
| Vercel | Vercel `deployments-cicd` installed and connector authenticated | Project creation, preview deployment, hosted verification |

## Design reference interpretation

- Source: `Pactset-Light-Dark-Motion.mp4`, inspected as six sampled frames across its 12-second duration.
- Use: color, material, composition, atmosphere, and brand direction only.
- Not accepted as: final motion specification, working WebGL, working 3D, or a functional website.
- Visual cues preserved: paired Opal/Obsidian atmospheres, slim glass navigation, wide navy editorial type, asymmetric pavilion composition, indigo/periwinkle calls to action, fine edge highlights, and dense bottom utility glass.

## Interactive 3D status

**Status: not started.** Stage 1 ships only scenery-only temporary pavilion artwork behind a reserved component boundary. Its temporary status is explicit in these project records, not as public implementation copy.

The following are explicit Stage 5 verification requirements and must not be marked complete until demonstrated in a browser:

- Gentle pavilion entrance while headline and buttons remain immediately usable.
- Real 3D depth with subtle cursor-responsive camera movement.
- Smooth daylight-to-evening lighting transition when themes change.
- Scroll progression introducing venue, crew, and payment milestones.
- Lightweight mobile behavior plus static and reduced-motion fallback.

## Stage 1 ledger

| Deliverable | Status | Evidence |
| --- | --- | --- |
| Product brief preservation | Verified | `docs/product-spec.md` copied from supplied brief; source and copy SHA-256 matched during inspection |
| Requirements matrix | Implemented | `docs/requirements-matrix.md`; status updates continue during build |
| Five-stage implementation plan | Implemented | `docs/implementation-plan.md`; self-reviewed, not independently reviewed |
| Next.js application | Verified | Next.js 16.3.8 / React 19.3; typecheck, lint, unit tests, browser tests, and production build pass |
| Opal/Obsidian design system | Verified | Light/dark desktop and 390px mobile evidence in `docs/screenshots/` |
| Role shells and navigation | Verified | Organizer, supplier, crew, support routes; desktop/sidebar and mobile bottom navigation exercised |
| Regional preferences | Verified | Independent controls persist locally; browser reload test passes |
| Fictional demo path | Verified | Explicit fixture and unavailable-capability labels; browser journey passes |
| GitHub private repository | Verified | Private `miracle352/Pactset`; verified design repair `431a6e37e821ff0b59d984dc3cf9efeb5372058b` pushed to `main` without force; the metadata follow-up is recorded in the final delivery report |
| Vercel preview | Verified | Single browser-imported `pactset` project at `https://pactset.vercel.app`; exact private repository and `main` branch linked |
| Hosted browser verification | Verified | Actual production URL opened and repeated desktop/mobile, theme, navigation, and route checks passed |

## Verification evidence

- `npm run typecheck`: passed.
- `npm run lint`: passed with Biome 2.5.15.
- `npm test`: 6/6 passed, including Stage 2A migration boundary assertions.
- `node tests/stage2a-remote.mjs verify`: 12/12 passed against `pactset-development`; email-link verification and recovery are explicitly excluded and remain blocked.
- `npm run build`: passed; public pages prerender and auth/workspace/settings routes remain dynamic. The build required a shared host session because OneDrive blocked generated `.next` route directories inside the managed sandbox.
- `npm run test:e2e`: 23 passed, 3 expected project-specific skips across desktop and mobile Chromium projects; required 360/390/430/768/1440 widths, short mobile viewport, both themes, enlarged text, menu/sticky-action conflict, persistence, routes, overflow, whole-card role links, keyboard focus, fine-pointer hover, mobile tap, and reduced motion were exercised.
- `npm audit --audit-level=high`: 0 vulnerabilities after replacing a vulnerable ESLint glob dependency chain with the Next.js-supported Biome linter.
- Secret-pattern scan: no credential, private-key, seed, or API-key pattern found outside the preserved product brief.
- Visual review: light/dark desktop and mobile screenshots inspected; corrected the initial font mismatch before accepting evidence.
- Browser smoke: all public/role routes returned HTTP 200; no captured page errors or failed requests in the evidence runs.
- Git publication: staged changes were reviewed, the secret scan passed, the private repository was created empty, and `main` was pushed successfully without force.
- Hosted verification: `https://pactset.vercel.app` was opened directly after deployment; the core visual, theme, navigation, route, and overflow checks were repeated against the hosted application.

## Stage 1 design review

| Before | After | Why |
| --- | --- | --- |
| Copied local font files rendered as a serif | Self-hosted Manrope variable font package | Matches the approved wide sans composition and keeps builds independent of Google Fonts |
| Generic missing-state risk | Explicit loading, empty, error, disabled, and unavailable presentations | Users can distinguish missing integrations from successful actions |
| Approved website reference was embedded as hero content, duplicating navigation and actions | Rebuilt one semantic HTML hero over standalone scenery-only pavilion artwork | The reference informs visual direction but is no longer page content |
| Mobile inherited the desktop composition | Dedicated portrait hero, compact header, role-path selector, vertical four-step sequence, and deferred safe-area action | Preserves hierarchy and reachability on narrow and short screens |
| Public implementation notes interrupted product copy | Honest concise Testnet/demo boundary; temporary/3D status remains in project records | Keeps the public story clear without overstating payments or 3D |
| Public roles could imply privilege | Support separated from Organizer/Supplier/Crew onboarding | Preserves assigned-only support access |

## Fixture-only and unavailable boundaries

- Stage 1 role dashboards, event summaries, tasks, readiness, offers, crew shifts, support cases, and financial snippets are fictional presentation fixtures only.
- Stage 1 has no authentication, database, live provider discovery, chat, upload, AI, wallet, Stellar account, trustline, balance, quote, conversion, escrow, transaction, scheduler, notification, or 3D renderer.
- Unavailable controls must explain which later-stage capability is missing and must not display simulated success.

## Decision log

- New sibling project selected because existing repositories are unrelated.
- Native CSS tokens selected for the branded glass aesthetic; no third-party design system will be misrepresented as Opal/Obsidian.
- Stage 1 preferences may use versioned local storage because they are non-sensitive UI preferences; authoritative account/agreement settings wait for persistent backend work.
- The approved pavilion artwork is a temporary visual fallback, not a 3D implementation.
- Vercel access note: the browser session can read the specific private repository, while the API connector still returns a separate account-scope authorization error. The browser import route is the authorized fallback; no security setting or repository visibility change is required.

## Stage 2B browser-payment checkpoint — 2026-10-05

- Implemented real Freighter ownership/signing UI, server-prepared Testnet envelopes, exact conversion quote, separate escrow funding, private evidence, correction, approval/release, dispute/resolution and ledger reconciliation.
- Confirmed fresh TUSD end-to-end Testnet transfers and generic TEUR conversion with genuine hashes. Automated fixture signing is explicitly not browser-extension proof.
- Added caller-scoped local reconciliation, durable idempotency/pending state and conversion-success/funding-retry UI.
- Desktop/mobile browser checks pass in both themes and screenshots were visually reviewed. Production build passes with webpack; Turbopack is blocked only by OneDrive generated-directory `EPERM`.
- No push or website deployment. Restricted staging and manual Freighter/two-crew/support rehearsal remain gated by explicit authorization and private user interaction.

## Stage 2B isolated-failure and staging checkpoint — 2026-10-05

- Added an idempotent, ignored-state Testnet verifier that creates disposable accounts only. The registered TUSD path failed with `op_no_trust` for a destination lacking a trustline; a deliberately drained disposable account failed trustline creation with `op_low_reserve`; a fresh unissued `TNOQ` asset had zero offers and zero strict-receive paths. No successful demo agreement or escrow was touched.
- Read-only Vercel dashboard inspection confirmed project `pactset` (`prj_YFD3oimOHAfrcRMcAyjIS2J1zNjT`) under the `miracle352` Hobby scope, Standard Vercel Authentication enabled, password protection unavailable without upgrade, protected sourcemaps enabled, and no project environment variables configured. The connector itself still lacks authorization for this scope.
- Read-only Supabase inspection confirmed staging callbacks have not been added: Site URL is localhost and the only redirect allow-list entry is `http://localhost:3000/**`.
- The restricted-staging plan now documents Preview-only variables, exact callbacks, layered Vercel/Supabase protection, caller-scoped reconciliation, a real Freighter sequence, and organizer/supplier/two-crew/support rehearsal.
- Second-crew and support credentials are prepared in the ignored local fixture file, but the external Auth account creation submit remains pending the required action-time confirmation. No role is stored in editable user metadata; support will be inserted through database administration and audited only after its Auth UUID exists.
- Email confirmation and password recovery remain unverified. No email verification setting was disabled and no rate-limited retry was attempted.
- Crew B and support now exist as separate auto-confirmed development fixtures in `pactset-development`; global signup **Confirm email** remains enabled. Roles were assigned through database administration, not user metadata, and the support assignment has an audit record.
- A fresh client/RLS verification passed 24/24 checks across organizer, supplier, Crew A, Crew B, support and unrelated identities. Ordinary support self-assignment was rejected; private agreements/evidence stayed hidden from Crew B, support-without-resolver and the unrelated account.
- Assigned-case support remains unimplemented. The existing narrow resolver-wallet payment boundary must not be described as an assigned-case system; no support wallet was bound and no broad access was granted.
