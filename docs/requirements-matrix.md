# Pactset requirements matrix

Statuses: **Not started**, **Fixture only**, **Implemented**, **Verified**, **Blocked**. “Fixture only” means visible fictional data or interaction exists without the authoritative backend behavior.

## Foundation and design

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FND-001 | 1 | Preserve source brief, matrix, staged plan, and progress evidence | `docs/*` | None | Hash source copy; coverage review | Verified |
| FND-002 | 1 | New maintained Next.js + TypeScript foundation or suitable existing stack | All | None in Stage 1 | Typecheck, lint, test, production build | Verified |
| FND-003 | 1 | Keep unrelated workspace work untouched | Repository | None | Git status and diff review | Verified |
| FND-004 | 1 | Safe ignore rules, placeholder-only environment example, setup README | Repository | Secret isolation contract | Secret scan and staged diff | Verified |
| DSG-001 | 1 | Consistent original Pactset mark, wordmark, favicon, and social image | Global metadata/header | None | Visual review; metadata fetch | Implemented |
| DSG-002 | 1 | Opal Glass: pearl, icy blue, lavender, dark ink, indigo actions | All light routes | None | Desktop/mobile screenshots and contrast check | Verified |
| DSG-003 | 1 | Obsidian Glass: deep navy, smoked glass, soft white, periwinkle actions | All dark routes | None | Desktop/mobile screenshots and contrast check | Verified |
| DSG-004 | 1 | Light, Dark, and System everywhere; persisted and flash-resistant | All routes/dialogs/menus | Optional account sync later | Reload/system-change browser tests | Verified |
| DSG-005 | 1 | Frosted material, edge highlights, restrained reflections/shadows, denser finance/message surfaces | Shared components | None | Visual review in both themes | Verified |
| DSG-006 | 1 | Wide editorial typography and original cohesive composition | Landing and shells | None | Visual review at 375/768/1440 | Verified |
| DSG-007 | 1 | Accessible contrast, focus, touch targets, dropdowns, reduced motion | All | None | axe plus manual keyboard/focus review | Implemented |
| DSG-008 | 1 | Loading, disabled, error, empty, success, hover, and active states | Shared state gallery / controls | Later actions provide real state | Interaction and visual checks | Verified |
| DSG-009 | 1 | Responsive navigation, viewport-safe menus, mobile safe areas | All shells | None | Narrow viewport navigation checks | Verified |
| LND-001 | 1 | Landing headline “Every detail. One shared plan.” | `/` | None | Exact-copy assertion | Verified |
| LND-002 | 1 | Actions “Plan an event” and “Explore the demo” lead somewhere honest | `/` | None in Stage 1 | Click-path test; no dead primary actions | Verified |
| LND-003 | 1 | Explain product and Stellar’s actual Testnet role without fake proof | `/` | None | Copy review: no logos/testimonials/counters/guarantees | Verified |
| LND-004 | 1 | Standalone scenery-only pavilion artwork used as a documented temporary fallback; no baked-in UI, text, browser frame, or reference labels | `/` | None | Asset and rendered-page visual inspection | Verified |
| LND-005 | 1 | Stable component boundary reserved for interactive pavilion | `/` | 3D asset delivery later | Component test; no WebGL claim | Verified |
| LND-012 | 1 | Hero navigation, headline, supporting copy, actions, and feature labels are real accessible HTML, with exactly one of each primary element | `/` | None | DOM assertions and rendered-page inspection | Verified |
| LND-013 | 1 | Mobile has a compact header, portrait pavilion composition, primary/quiet actions, role selector, concise four-step sequence, and no desktop-column crop | `/` | None | Visual QA at 360/390/430 and a short viewport | Verified |
| LND-014 | 1 | Organize/Supply/Join crew selector changes plain-language explanation and destination | `/` | None in Stage 1 | Keyboard and click-path tests | Verified |
| LND-015 | 1 | Safe-area planning action appears only after the original hero action leaves view and yields to menus/dialogs/keyboard | `/` | None | Intersection, menu-conflict, and visual-viewport tests | Verified |
| LND-016 | 1 | Public copy omits implementation notes and clearly distinguishes unavailable payments from fictional Testnet presentation | `/` | None | Copy assertions and manual review | Verified |
| LND-006 | 5 | Realistic interactive pavilion geometry, contact shadows, and lighting | `/` | Asset/runtime delivery | Browser demonstration and visual QA | Not started |
| LND-007 | 5 | Gentle pavilion entrance; headline/buttons immediately usable and stable | `/` | None | Timed browser interaction during entrance | Not started |
| LND-008 | 5 | Real 3D depth with subtle cursor-responsive camera movement | `/` | None | Pointer movement/browser frame evidence | Not started |
| LND-009 | 5 | Smooth daylight-to-evening lighting transition on theme change | `/` | Theme event into renderer | Recorded browser theme transition | Not started |
| LND-010 | 5 | Scroll introduces venue, crew, and payment milestones | `/` | Fixture/content inputs | Scroll journey recording and assertions | Not started |
| LND-011 | 5 | Lazy load, capped rendering, offscreen pause, lightweight mobile, static/reduced-motion fallback | `/` | None | Performance profiles; mobile and media emulation | Not started |
| AVT-001 | 4 | Original customizable cartoon avatars; no assumed Bitmoji/Snapchat | Profiles/chat | Persist avatar selections | Asset originality and integration review | Not started |

## Roles, profiles, settings, and discovery

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ROL-001 | 1/2 | Organizer, supplier, and crew onboarding; one account may hold multiple roles | `/onboarding`, `/auth/sign-up`, `/settings` | Auth + role membership | Public UI verified; database authorization tests pending | Implemented locally; remote verification blocked |
| ROL-002 | 1/2 | Support cannot be self-selected; assignment is server-enforced | `/onboarding`, `/support`, `/workspace/support` | Support assignment policy | Public boundary plus unrelated-account self-assignment denial passed | Verified in development |
| REV-001 | 2A | Repair broken organizer navigation targets; every enabled item opens meaningful content | Public demo and `/workspace/organizer/*` | Route authorization | Public link crawl passed; authenticated data routes pending live session | Implemented locally; remote verification blocked |
| REV-002 | 2A | Replace repetitive role shells with task-specific organizer, supplier, crew, and support layouts | `/workspace/*` | Role-scoped queries | Source/build verified; separate-account review pending | Implemented locally; remote verification blocked |
| REV-003 | 2A | Use compact workspace headings instead of oversized marketing headlines | `/workspace/*` | None | Responsive CSS/source review; authenticated screenshots pending | Implemented locally; remote verification blocked |
| REV-004 | 2A | Remove development copy and component-state showcases from user routes | Public and authenticated routes | Development-only boundary | Copy scan and public browser inspection passed | Verified locally |
| REV-005 | 2A | Searchable global country, city/service area, language, and IANA timezone controls | `/settings` | Persist independent preferences | Build verified; live persistence test pending | Implemented locally; remote verification blocked |
| REV-006 | 2A | Original customizable avatars and useful provider profiles | `/settings`, provider views | Profile/avatar persistence and RLS | Original UI present; cross-account visibility pending | Implemented locally; remote verification blocked |
| REV-007 | 2A | Persistent event drafts survive sign-out and later sign-in | Organizer event editor | Event ownership and durable storage | Separate-account sign-out/sign-in draft resume passed | Verified in development |
| REV-008 | 2A | Supplier inventory quantities cannot be over-reserved across overlapping bookings | Supplier inventory/offers | Locked capacity check and expiring reservation | Migration assertions pass; live concurrent test pending | Implemented locally; remote verification blocked |
| REV-009 | 2A | Crew cannot accept conflicting shifts without an explicit supported resolution | Crew schedule/offers | Locked overlap check | Migration assertions pass; live conflicting-shift test pending | Implemented locally; remote verification blocked |
| REV-010 | 2A | Account authentication and future Stellar wallet connection are separate concepts and gates | Auth, settings, agreements | Independent account and wallet state | Copy, routes, and disabled wallet boundary verified | Verified locally |
| AUTH-001 | 2A | Sign up, sign in, sign out, restored cookie session, email verification, and password recovery | `/auth/*`, `proxy.ts` | Supabase Auth with safe callbacks | Login/logout/re-login passed; real confirmation and recovery links blocked by email rate limit | Partially verified; email links blocked |
| AUTH-002 | 2A | Never trust browser-submitted role, owner, or account IDs; enforce server and database authorization | Server actions and `/workspace/*` | Auth identity, RLS, constrained functions | Unrelated read/update and support escalation denied through Data API | Verified in development |
| EVT-001 | 2A | Persistent event draft captures venue, timezone, dates, capacity, requirements, manual budget, and preparation deadline | `/workspace/organizer/events/*` | Owned event rows with `timestamptz` plus named timezone | Validation/build pass; persistence and DST cases pending | Implemented locally; remote verification blocked |
| REQ-001 | 2A | Organizer publishes privacy-safe request; eligible supplier or crew submits a decimal-priced offer | Request and offer routes | Deliberate feed RPC plus server-authored identity | Separate supplier and crew accounts discovered requests and submitted offers | Verified in development |
| NEG-001 | 2A | Versioned counter/reject/withdraw/same-version acceptance; stale/retry/concurrent requests stay safe | Offer detail routes | Locked transactional functions, audit, idempotency | Duplicate retry, stale version, and concurrent acceptance passed | Partially verified; rejection/withdrawal not live-tested |
| AGR-2A-001 | 2A | Agreement exists only after both parties accept current terms and remains explicitly unfunded | Agreement views | Immutable current offer version and `awaiting_testnet_funding` status | Separate parties created supplier and crew agreements; persisted after re-login | Verified in development |
| ROL-003 | 1 | Distinct organizer, supplier, crew, and support route shells/nav | `/organizer`, `/supplier`, `/crew`, `/support` | None in Stage 1 | Route/navigation visual QA | Verified |
| ROL-004 | 1 | Role-specific mobile bottom/focused navigation | Role shells | None | 375px route journey | Verified |
| ROL-005 | 1 | Organizer, Supplier, and Crew preview cards are whole-card links with hover, focus, touch, and reduced-motion feedback | `/onboarding` | None | Destination, keyboard, touch, theme, and reduced-motion browser tests | Verified |
| PRF-001 | 3/4 | Profiles include skills/services, portfolio, area, availability, pricing unit/currency, history, ratings | Profile routes | Persistent profile + authorization | CRUD and visibility tests | Not started |
| PRF-002 | 4 | Accepted/completed jobs public as appropriate; declines private | Profiles | Scoped query policy | Authorization and privacy tests | Not started |
| PRF-003 | 4 | Alleged abandonment requires review/appeal; cancellation is not automatic misconduct | Profiles/support | Case workflow/audit | Adversarial workflow tests | Not started |
| PRF-004 | 4 | Only actual participants review; provider response allowed | Reviews | Participant authorization | Separate-account tests | Not started |
| DSC-001 | 3 | Radar/list discovery with skill, availability, area, price, currency filters | Discovery | Search/index and access rules | Query and UI filter tests | Not started |
| DSC-002 | 3 | Approximate opt-in area only; no exact public live location | Discovery/profile | Location privacy policy | Data-shape and privacy tests | Not started |
| DSC-003 | 1 | Fictional demo people visibly labeled; no invented nearby providers | `/demo` | None | Copy/fixture assertion | Verified |
| SET-001 | 1/2 | Service area, language, named timezone, and preferred test currency independent | Preferences and `/settings` | Persist per account | Public independence verified; authenticated persistence pending | Implemented locally; remote verification blocked |
| SET-002 | 1 | Preferred currency choices are TUSD, TGBP, TAUD | Preferences | Asset registry later | Option-value test | Verified |
| SET-003 | 1/2 | Preference changes do not alter an existing agreement’s settlement currency | Preferences/agreements | Agreement currency copied from accepted version | Migration/source review; live mutation test pending | Implemented locally; remote verification blocked |
| SET-004 | 3 | Event time and user local time labeled; named zones and absolute instants handle DST | Events/tasks | Time model | DST/timezone tests | Not started |

## Planning, budgets, agreements, readiness, and replacement

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PLN-001 | 3 | AI gathers full event constraints before suggesting budgets | Planning flow | Validated planning schema + AI guardrails | Missing-field and permission tests | Not started |
| PLN-002 | 3 | Editable allocation; estimates distinct from quotes; approval publishes but does not authorize spend | Budget/requests | Versioned budget and authorization | State-transition tests | Not started |
| AGR-001 | 2/3 | Provider accept/counter with price, scope, deadline, reasons; affected parties accept final terms | Offers/agreements | Versioned offer workflow | Local implementation complete; separate-party proof pending | Implemented locally; remote verification blocked |
| AGR-002 | 2/3 | Enforce reservations against double booking/over-capacity | Offers/availability | Transactional capacity reservation | Static safety assertions pass; database concurrency tests pending | Implemented locally; remote verification blocked |
| AGR-003 | 3 | Planned, quoted, committed, funded, paid, remaining kept separate; no unlabeled cross-asset sums | Finance surfaces | Exact-unit ledger projection | Arithmetic and display tests | Not started |
| AGR-004 | 3 | Venue hire, rental, and purchase have distinct terms/milestones/cancellation | Agreements | Typed service contract models | Scenario tests | Not started |
| AGR-005 | 3 | Evidence/escrow do not guarantee delivery or safety | Agreement/evidence copy | None | Copy review | Not started |
| AGR-006 | 3 | Prep deadline, early food exception, event/teardown/return duties, late-event compliance | Timeline | Deadline rules | Boundary/date tests | Not started |
| AGR-007 | 3 | Shared countdown, original deadlines, organizer delays, accepted extensions | Event/agreement | Immutable audit/versioning | Timeline/version tests | Not started |
| RDY-001 | 3 | Deterministic readiness dependencies, blockers, responsible party, next action | Readiness | Dependency engine | Deterministic graph tests | Not started |
| RDY-002 | 3 | AI may explain readiness but cannot fabricate it | Readiness assistant | Retrieval/permission validation | Hallucination guard tests | Not started |
| CHG-001 | 3 | Scope change identifies impact, affected acceptance, extra funding gate; original remains active until activation | Change requests | Versioned agreements/workflow | 80→120 scenario tests | Not started |
| CHG-002 | 3 | Agreement history is versioned and never silently mutated | Agreements/audit | Append-only version model | Immutability tests | Not started |
| REP-001 | 3 | Replacement identifies impact, notifies parties, filters availability/requirements/time/area/budget | Replacement flow | Search + dependency service | Available/unavailable replacement tests | Not started |
| REP-002 | 3 | Organizer approves invitation/new booking; original resolved separately; never use disputed/owed funds | Replacement/finance | Separate agreement/funding transitions | Financial isolation tests | Not started |

## Stellar Testnet payments

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PAY-001 | 1/2 | Testnet-only, dedicated dev wallets, prominent network/no-real-value labels, no real KYC/withdrawals | Global demo/finance | Network allowlist | Stage 1 labels; Stage 2 network rejection tests | Fixture only |
| PAY-002 | 2 | Extensible registry for TUSD/TGBP/TAUD with network, code, issuer; no fiat/redeemability claims | Asset screens | Trusted asset registry | Issuer/network tests and copy audit | Not started |
| PAY-003 | 2 | Controlled issuance/distribution/liquidity; XLM and supported assets only; trustlines/balances ready | Wallet/exchange | Issuer/distributor/liquidity services | End-to-end Testnet evidence | Not started |
| PAY-004 | 2 | Quote shows receive, max spend, simulated rate, expiry, fees | Convert | Quote service | Expiry/fee UI and unit tests | Not started |
| PAY-005 | 2 | Convert before funding; agreement held in provider currency; do not claim Classic+Soroban atomicity | Convert/fund | Sequenced idempotent workflow | Failure-boundary tests | Not started |
| PAY-006 | 2 | Conversion success + funding failure exposes balance and safe retry; no liquidity/expiry gives failure/requote | Convert/fund | Durable operation state | Adversarial recovery tests | Not started |
| PAY-007 | 2 | Soroban escrow identifies agreement/milestone, asset, amount, participants, auth, terms version, transitions | Agreement funding | Contract + server validator | Contract/unit/integration tests | Not started |
| PAY-008 | 2 | Atomicity claims limited to one atomic transaction, not whole event by default | Finance copy | Transaction grouping model | Copy and transaction-boundary review | Not started |
| PAY-009 | 2/4 | Human releases once; support hold/adjudication bounded; completed transfers irreversible; disputed funds isolated | Milestones/support | Contract authorization + case workflow | Duplicate/wrong-role/dispute tests | Not started |
| PAY-010 | 4 | Nonresponse escalation and resolution timing; no automatic AI payment decision | Support/case | Scheduler/case transitions | Timeout and authority tests | Not started |
| PAY-011 | 2 | Server constructs/validates actions; wallet signs; no seed phrase; secure account-wallet binding | Wallet/signing | Auth binding and transaction builder | Wrong wallet/signature tests | Not started |
| PAY-012 | 2 | Exact asset math, idempotency, authorization, server checks | All finance | Decimal/sequence/request keys | Unit and property tests | Not started |
| PAY-013 | 2 | Ledger-confirmed states and real explorer links; reconcile pending after refresh/timeout/restart | Transactions | Reconciliation worker | Restart/timeout/refresh tests | Not started |
| PAY-014 | 2 | Fees/reserves, contract lifetime, and Testnet resets handled explicitly | Wallet/admin | Operational monitoring/recovery | Reset/low-reserve/TTL tests | Not started |

## Evidence, communication, cancellation, support, and reputation

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| EVD-001 | 3 | Milestone photo/video upload progress, retry, validation, restricted access | Evidence | Private resumable storage + ACL | Failed/resumed upload tests | Not started |
| EVD-002 | 3 | Upload, AI completeness, organizer approval, and release are distinct; AI cannot certify safety/quality | Evidence/milestone | State machine + AI guardrails | Transition and copy tests | Not started |
| EVD-003 | 3/4 | Correction and milestone feedback; final ratings after completed work | Evidence/reviews | Participant/work-completion checks | Workflow tests | Not started |
| CHT-001 | 4 | Persistent chat, language detection, translations, originals, override, delivery, attachment ACL | Chat | Realtime store/translation/access | Multi-session and failure tests | Not started |
| CHT-002 | 4 | Unavailable translation explained, never faked | Chat | Translation error state | Provider failure test | Not started |
| AI-001 | 4 | Tagged AI can summarize/draft/suggest/prepare; commitments/changes/money need approval | Chat/assistant | Permission/current-state validation | Prompt-injection and action-gate tests | Not started |
| AI-002 | 4 | Chat is untrusted input | Assistant backend | Isolation and validation | Injection/adversarial tests | Not started |
| SUP-001 | 4 | Assigned support sees relevant chats/agreements/evidence with disclosed access | Support cases | Scoped authorization | Separate-role ACL tests | Not started |
| SUP-002 | 4 | @support escalation, private and joint case conversations | Chat/support | Case/conversation membership | Visibility tests | Not started |
| SUP-003 | 4 | Profanity signal offers calm reminder, not fault finding; language/context caveat | Chat/support | Advisory classifier only | False-positive/context tests | Not started |
| CAN-001 | 4 | Cancellation reason and agreement/reservation/work/funding/terms checks | Cancellation | Policy/state validator | Partial-work scenario tests | Not started |
| CAN-002 | 4 | AI may flag off-app/evasion for review, not determine fraud or deny earned payment | Cancellation/support | Review queue only | Authority tests and copy review | Not started |
| CAN-003 | 4 | Contextual off-platform notice does not erase legal obligations | Cancellation/chat | None | Copy review | Not started |
| AUD-001 | 4 | Support actions limited by contract powers; audit actor, authority, reason, before/after, tx ref | Support/audit | Append-only audit log | Authorization and audit completeness tests | Not started |
| AUD-002 | 4 | Wage disputes use same auditable process | Support/disputes | Case policy | Scenario test | Not started |

## Reliability, test design, delivery, and operations

| ID | Stage | Requirement | UI / route | Backend responsibility | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| REL-001 | 2+ | Persistent identity, roles, events, offers, agreements, evidence metadata, chat, cases | Product routes | Hosted database/auth/storage | Stage 2A schema/client implemented; correct organization verified; free-project quota blocks provisioning | Partially implemented; quota blocked |
| REL-002 | 2 | Chain authoritative for movement; DB stores reconciled projection only | Finance/admin | Reconciliation model | Ledger/DB divergence tests | Not started |
| SEC-001 | 1+ | Private evidence, role-scoped IO, validation, secret isolation, rate limits, audit events | All protected routes | Security controls | Security review and authorization tests | Not started |
| SEC-002 | 2+ | No chat/evidence/identity docs on public chain; commitments leak no private content | Contract explorer/audit | Privacy-preserving contract fields | On-chain data inspection | Not started |
| REL-003 | 3+ | Slow/offline states and resumable evidence; notifications for material events | Shared states | Queue/scheduler/push/email | Offline and scheduler tests | Not started |
| REL-004 | 1+ | Never claim reminders/background work without running scheduler | Copy/status | Scheduler health | Copy/ops review | Not started |
| DEM-001 | 1 | Explicit Solo Test Lab / demo fixture boundary and role simulation | `/demo` | None in Stage 1 | Labels and navigation test | Verified |
| DEM-002 | 2+ | Test independent accounts/sessions/wallets; reset uses fresh IDs and cannot erase ledger | Test lab | Seed/reset service | Separate-context and reset tests | Not started |
| DEM-003 | 1/5 | Fictional live-demo cast: organizer, supplier, two crew, user as support; varied scenarios/currencies | `/demo` | Seed service later | Fixture assertions and rehearsal | Fixture only |
| DEM-004 | 1/3 | Supplier venue, rental equipment, and purchased signage are distinct fictional services | Demo/supplier | Typed seed models later | Fixture/type tests | Fixture only |
| ACC-001 | 2 | Core end-to-end acceptance from event creation through confirmed recipient balance/transaction | Full app | All Stage 2 services | Separate-session browser + ledger evidence | Not started |
| ACC-002 | 2-5 | Adversarial matrix covers role/wallet/issuer/network, liquidity, duplicates, failures, disputes, time, replacement, upload/translation | Test suites | All services | Automated/manual adversarial report | Not started |
| ACC-003 | 1-5 | Functional paths checked on phone/desktop and both themes; no dead primaries or mock success | All | N/A | Browser QA every stage | Verified |
| OPS-001 | 1 | Create private personal GitHub repository, inspect staged diff, commit and push | Repository | Git provider | Repo URL and remote commit hash | Verified |
| OPS-002 | 1 | Create/link Vercel project and working preview; local build is insufficient | Hosted app | Vercel | Open actual URL; hosted smoke/visual checks | Verified |
| OPS-003 | 1+ | No credential/private-key commits or public client secrets | Repository/hosting | Secret store | Git history/staged secret scan | Verified |
| OPS-004 | 1+ | Report exact implementation, URLs, hashes, screenshots, checks, blockers, and remaining scope | `docs/progress.md` / handoff | None | Evidence review | Implemented |

## Stage boundary summary

- **Stage 1:** only foundation, design, route shells, local non-sensitive preferences, fictional demo presentation, repository, preview, and verification.
- **Stage 2:** first real persistent booking and Stellar Testnet settlement proof.
- **Stage 3:** planning, agreements, readiness, evidence, change, replacement.
- **Stage 4:** chat, AI/translation, cancellation, support, disputes, reputation.
- **Stage 5:** interactive 3D pavilion, full refinement, adversarial rehearsal, and deployment hardening.
