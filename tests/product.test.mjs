import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("landing implements the Pactset architectural system without sample-brand copy", async () => {
  const page = await read("src/app/page.tsx");
  const footer = await read("src/components/landing/landing-footer.tsx");
  const styles = await read("src/app/globals.css");
  assert.match(page, /A thousand moving parts/);
  assert.match(page, /One seamless experience/);
  assert.match(page, /Plan an event/);
  assert.match(page, /Find work/);
  assert.doesNotMatch(page, /shared plan|Explore demo/i);
  assert.match(styles, /photo-1519608487953-e999c86e7455/);
  assert.match(styles, /#061f1e/i);
  assert.match(styles, /#dfa12d/i);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(footer, /Copyright © \{new Date\(\)\.getFullYear\(\)\} Pactset/);
  assert.doesNotMatch(`${page}\n${footer}`, /VELORA|creative platform/i);
});

test("public onboarding excludes support from selectable roles", async () => {
  const source = await read("src/app/onboarding/page.tsx");
  const selectable = source.slice(source.indexOf("const choices"), source.indexOf("export default"));
  assert.doesNotMatch(selectable, /name: "Support"/);
  assert.match(source, /Support is assigned, not self-selected/);
  assert.match(source, /empty, private workspace/);
  assert.match(source, /Start as \{name\.toLowerCase\(\)\}/);
  assert.match(source, /\/auth\/sign-up\/organizer/);
  assert.doesNotMatch(source, /Preview \{name\.toLowerCase\(\)\} shell/);
});

test("the application is dark-only and does not expose obsolete theme controls", async () => {
  const layout = await read("src/app/layout.tsx");
  const header = await read("src/components/navigation/site-header.tsx");
  const shell = await read("src/components/workspace/workspace-shell.tsx");
  assert.match(layout, /data-theme="dark"/);
  assert.match(layout, /colorScheme: "dark"/);
  assert.doesNotMatch(`${layout}\n${header}\n${shell}`, /ThemeControl|ThemeScript|Light theme|System theme/);
});

test("the global test-currency catalogue stays separate from provisioned Stellar assets", async () => {
  const product = await read("src/lib/product.ts");
  const regions = await read("src/lib/regions.ts");
  const preferences = await read("src/components/preferences/preferences-panel.tsx");
  for (const code of ["TUSD", "TGBP", "TAUD"]) assert.match(product, new RegExp(code));
  assert.match(regions, /Intl\.supportedValuesOf\("currency"\)/);
  assert.match(regions, /const assetCode = `T\$\{currencyCode\}`/);
  assert.match(preferences, /never changes the settlement currency of an existing agreement/);
});

test("the retired pavilion direction is not mounted on the landing page", async () => {
  const page = await read("src/app/page.tsx");
  const styles = await read("src/app/globals.css");
  assert.doesNotMatch(page, /PavilionScene|pavilion-scene|from ["']three["']/i);
  assert.doesNotMatch(styles, /pavilion-scene|pavilion-canvas|pavilion-narrative/i);
  assert.match(page, /ArchitecturalLines/);
});

test("account password fields expose accessible non-submit visibility controls", async () => {
  const form = await read("src/components/auth/auth-form.tsx");
  assert.match(form, /type=\{visible \? "text" : "password"\}/);
  assert.match(form, /type="button"/);
  assert.match(form, /aria-label=\{visible \? `Hide \$\{field\.label\.toLowerCase\(\)\}` : `Show \$\{field\.label\.toLowerCase\(\)\}`\}/);
});

test("authenticated header distinguishes a saved wallet from browser readiness", async () => {
  const headerWallet = await read("src/components/payments/header-wallet-control.tsx");
  assert.match(headerWallet, /isConnected\(\)/);
  assert.match(headerWallet, /getAddress\(\)/);
  assert.match(headerWallet, /getNetwork\(\)/);
  assert.match(headerWallet, /Ownership<\/dt><dd>Verified/);
  assert.match(headerWallet, /Ready in browser/);
  assert.match(headerWallet, /pactset-wallet-disconnected-v1/);
});

test("Stage 2A migration enforces authorization and concurrency boundaries", async () => {
  const migration = await read("supabase/migrations/20261004133435_stage_2a_core.sql");
  for (const table of ["profiles", "account_roles", "provider_profiles", "inventory_items", "events", "requests", "offers", "offer_versions", "offer_reservations", "agreements", "audit_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /revoke all on all tables in schema public from anon/i);
  assert.match(migration, /roles_insert_public[\s\S]*role in \('organizer','supplier','crew'\)[\s\S]*assigned_by is null/i);
  assert.doesNotMatch(migration, /roles_insert_public[\s\S]{0,250}role in \([^)]*support/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /organizer_accepted_at = null, provider_accepted_at = null/);
  assert.match(migration, /awaiting_testnet_funding/);
  assert.match(migration, /request_id = v_offer\.request_id and id <> v_offer\.id and status in \('submitted', 'countered'\)/);
  assert.match(migration, /security definer[\s\S]*has_active_provider_role|has_active_provider_role[\s\S]*security definer/i);
});

test("public UI has no internal stage labels and keeps wallet actions out of the fixture demo", async () => {
  const files = ["src/app/not-found.tsx", "src/app/opengraph-image.tsx", "src/app/demo/page.tsx", "src/components/auth/auth-form.tsx"];
  const sources = await Promise.all(files.map(read));
  const source = sources.join("\n");
  assert.doesNotMatch(source, /Stage 1|Stage 2|docs-not-available/);
  assert.match(source, /public fixture never connects a wallet/i);
});

test("Stage 2B schema and contract preserve wallet, asset, evidence, and escrow boundaries", async () => {
  const migration = await read("supabase/migrations/20261004223000_stage_2b_payments.sql");
  const grants = await read("supabase/migrations/20261005004500_stage_2b_service_grants.sql");
  const contract = await read("contracts/pactset-escrow/src/lib.rs");
  for (const table of ["test_asset_registry", "wallet_connections", "wallet_challenges", "payment_quotes", "agreement_escrows", "escrow_milestones", "payment_transactions", "milestone_evidence"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /bucket_id = 'milestone-evidence'/);
  assert.match(migration, /check \(asset_code = 'T' \|\| currency_code\)/);
  assert.match(grants, /grant select, insert, update on public\.wallet_challenges to service_role/i);
  assert.doesNotMatch(grants, /to authenticated/i);
  assert.match(contract, /cfg\.payer\.require_auth\(\)/);
  assert.match(contract, /cfg\.payee\.require_auth\(\)/);
  assert.match(contract, /cfg\.resolver\.require_auth\(\)/);
  assert.match(contract, /MilestoneState::Disputed/);
});

test("wallet-created escrows and assigned support keep separate authorization boundaries", async () => {
  const migration = await read("supabase/migrations/20261005150000_stage_2b_user_escrow_and_assigned_support.sql");
  const membershipHardening = await read("supabase/migrations/20261005152000_support_case_active_membership.sql");
  const edge = await read("supabase/functions/stellar-payments/index.ts");
  const payments = await read("src/components/payments/payment-actions.tsx");
  for (const table of ["escrow_runtime_registry", "support_cases", "support_case_messages", "support_case_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /assigned_support_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /current_user not in \('service_role','postgres'\)/);
  assert.match(migration, /grant execute on function public\.finalize_escrow_deployment[\s\S]*to service_role/i);
  assert.match(membershipHardening, /can_access_support_case[\s\S]*account_roles[\s\S]*role = 'support'[\s\S]*status = 'active'/i);
  assert.doesNotMatch(migration, /grant execute on function public\.finalize_escrow_deployment[\s\S]{0,100}to authenticated/i);
  assert.match(edge, /Operation\.createCustomContract/);
  assert.match(edge, /payerWallet\.public_key === payeeWallet\.public_key/);
  assert.match(edge, /isAssignedSupport/);
  assert.match(edge, /kind === "contract_deploy"/);
  assert.match(payments, /transactionAction="create_escrow"/);
  assert.match(payments, /quoteId=\{quote\.id\}/);
});

test("verified wallet switching cannot rewrite existing escrow participants", async () => {
  const migration = await read("supabase/migrations/20261005153000_active_verified_wallets.sql");
  const walletAuth = await read("supabase/functions/wallet-auth/index.ts");
  const payment = await read("src/components/payments/wallet-connection.tsx");
  assert.match(migration, /unique index wallet_connections_one_active_user_network_idx[\s\S]*where active/i);
  assert.match(migration, /current_user not in \('service_role','postgres'\)/i);
  assert.match(migration, /revoke all on function public\.activate_wallet_connection[\s\S]*authenticated/i);
  assert.match(walletAuth, /rpc\("activate_wallet_connection"/);
  assert.match(payment, /existing escrows keep their original participant keys/i);
  assert.match(payment, /requestAccess\(\)/);
  assert.match(payment, /isConnected\(\)/);
});

test("recipient payout choices keep release, conversion, and sandbox withdrawal distinct", async () => {
  const migration = await read("supabase/migrations/20261006120000_stage_2b_recipient_payouts.sql");
  const edge = await read("supabase/functions/stellar-payments/index.ts");
  const payment = await read("src/components/payments/payment-actions.tsx");
  const walletSettings = await read("src/app/settings/wallet/page.tsx");
  for (const table of ["recipient_conversion_quotes", "sandbox_withdrawals"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(edge, /strictSendPaths/);
  assert.match(edge, /pathPaymentStrictSend/);
  assert.match(edge, /ctx\.agreement\.provider_id !== userId/);
  assert.match(migration, /Simulation only\. No bank, anchor, or real-world payout was contacted\./);
  assert.match(payment, /Keep \{agreementAsset\}/);
  assert.match(payment, /recipient_convert/);
  assert.match(payment, /Create sandbox withdrawal preview/);
  assert.match(walletSettings, /Wallet &amp; payments/);
  assert.match(walletSettings, /Pactset sign-in controls your account/);
});

test("agreement collaboration is scoped, immutable, and auditable", async () => {
  const migration = await read("supabase/migrations/20261009120000_stage_3_practical_collaboration.sql");
  const actions = await read("src/app/workspace/agreements/actions.ts");
  const interfaceSource = await read("src/components/agreements/agreement-collaboration.tsx");

  for (const table of ["agreement_messages", "deadline_extension_requests"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /revoke all on public\.agreement_messages, public\.deadline_extension_requests from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.agreement_messages, public\.deadline_extension_requests to authenticated/i);
  assert.match(migration, /can_access_agreement_collaboration[\s\S]*assigned_support_id = \(select auth\.uid\(\)\)[\s\S]*status in \('assigned','under_review'\)/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /Only the other agreement participant may respond/i);
  assert.match(migration, /deadline_extension_(requested|accepted|rejected)/i);
  assert.doesNotMatch(migration, /update public\.agreements\s+set\s+preparation_deadline/i);
  assert.match(actions, /fromZonedTime/);
  assert.match(interfaceSource, /The accepted deadline remains/);
  assert.match(interfaceSource, /Original message/);
  assert.match(interfaceSource, /Machine translation/);
  assert.match(interfaceSource, /neutral review/i);
});

test("chat attachments stay private and separate from milestone evidence", async () => {
  const migration = await read("supabase/migrations/20261011170000_private_chat_attachments_and_language_detection.sql");
  const guard = await read("supabase/migrations/20261011173000_chat_attachment_upload_guard.sql");
  const edge = await read("supabase/functions/conversation-attachments/index.ts");
  const composer = await read("src/components/agreements/chat-attachments.tsx");
  assert.match(migration, /conversation-attachments/);
  assert.match(migration, /false,26214400/);
  assert.doesNotMatch(migration, /image\/svg\+xml|text\/html/);
  assert.match(migration, /can_access_agreement_conversation/);
  assert.match(guard, /uploaded_by=\(select auth\.uid\(\)\)/);
  assert.match(edge, /createSignedUrl\(attachment\.object_path, 60/);
  assert.match(edge, /status", "pending"/);
  assert.doesNotMatch(edge, /milestone-evidence/);
  assert.match(composer, /Upload cancelled/);
  assert.match(composer, /Files are private and links expire/);
});

test("event changes are version-bound and cannot silently rewrite accepted agreements", async () => {
  const migration = await read("supabase/migrations/20261009143000_stage_3_event_change_requests.sql");
  const workflow = await read("src/components/events/event-change-workflow.tsx");
  for (const table of ["event_change_requests", "event_change_impacts"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /agreement_version integer not null/);
  assert.match(migration, /v_agreement\.offer_version <> v_impact\.agreement_version/);
  assert.match(migration, /Agreement terms changed; this request is stale/);
  assert.match(migration, /assigned_support_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.doesNotMatch(migration, /update public\.agreements\s+set/i);
  assert.match(workflow, /does not rewrite accepted terms, move escrow funds, or imply provider consent/i);
  assert.match(workflow, /Accept change/);
  assert.match(workflow, /Propose adjustment/);
});

test("Pactset Go is a bounded on-chain bundle, not a database-only atomic claim", async () => {
  const contract = await read("contracts/pactset-go/src/lib.rs");
  const migration = await read("supabase/migrations/20261009170000_pactset_go.sql");
  const edge = await read("supabase/functions/pactset-go/index.ts");
  const boundary = await read("docs/pactset-go-contract.md");
  assert.match(contract, /const MAX_BOOKINGS: u32 = 8/);
  assert.match(contract, /item\.provider\.require_auth\(\)/);
  assert.match(contract, /cfg\.organizer\.require_auth\(\)/);
  assert.match(contract, /current\.agreement_version != item\.agreement_version/);
  assert.match(contract, /EscrowClient::new\(env, &item\.escrow\)\.fund\(\)/);
  assert.match(contract, /BundleState::Refundable/);
  for (const table of ["pactset_go_runtime_registry", "pactset_go_bundles", "pactset_go_bookings", "pactset_go_transactions"]) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(migration, /current_user not in \('service_role','postgres'\)/);
  assert.match(migration, /agreement_version integer not null/);
  assert.match(edge, /Operation\.createCustomContract/);
  assert.match(edge, /new Contract\(bundle\.contract_address\)\.call/);
  assert.match(edge, /signed\.signatureBase\(\)/);
  assert.match(boundary, /one failed check or escrow funding call reverts the complete activation/i);
  assert.match(boundary, /does not retrofit funded legacy agreements/i);
});

test("budgets, reviews, and reminders preserve authorization and financial boundaries", async () => {
  const migration = await read("supabase/migrations/20261011190000_planning_reviews_reminders.sql");
  const coverage = await read("supabase/migrations/20261011191500_reminder_schedule_coverage.sql");
  const budget = await read("src/components/events/event-budget-planner.tsx");
  const reviews = await read("src/components/agreements/agreement-reviews.tsx");
  for (const table of ["event_budget_versions", "agreement_reviews", "scheduled_reminders"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /organizer_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /Reviews open after confirmed completion/);
  assert.match(migration, /values\(p_agreement_id,v_actor,v_subject/);
  assert.match(migration, /subject_id=v_actor/);
  assert.match(migration, /grant execute on function public\.refresh_scheduled_reminders\(\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.refresh_scheduled_reminders\(\) to authenticated/);
  assert.match(coverage, /pending_evidence/);
  assert.match(coverage, /pending_decision/);
  assert.match(coverage, /deadline_extension/);
  assert.match(budget, /does not accept an offer, change signed terms, or move Testnet funds/i);
  assert.match(reviews, /Only participants in this booking can review/i);
});

test("budget approval rejects stale drafts and reminder scheduling stays private", async () => {
  const budgetGuard = await read("supabase/migrations/20261011203500_reject_stale_budget_approval.sql");
  const reminderCron = await read("supabase/migrations/20261011203000_schedule_in_app_reminders.sql");
  assert.match(budgetGuard, /v_row\.version <> v_latest_version/);
  assert.match(budgetGuard, /A newer budget draft exists/);
  assert.match(reminderCron, /private\.run_scheduled_reminder_worker/);
  assert.match(reminderCron, /revoke all on function private\.run_scheduled_reminder_worker\(\) from public, anon, authenticated, service_role/);
  assert.match(reminderCron, /pactset-in-app-reminders/);
});

test("offer details remain participant-scoped and preserve the intended sign-in return", async () => {
  const migration = await read("supabase/migrations/20261011200000_fix_offer_participant_visibility.sql");
  const correction = await read("supabase/migrations/20261011200500_remove_recursive_offer_request_policy.sql");
  const page = await read("src/app/workspace/offers/[id]/page.tsx");
  const fallback = await read("src/app/workspace/offers/[id]/not-found.tsx");
  assert.match(migration, /o\.provider_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /r\.organizer_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /requests_offer_participant_select/);
  assert.match(correction, /drop policy if exists requests_offer_participant_select/);
  assert.doesNotMatch(migration, /using \(true\)/i);
  assert.match(page, /requireAccount\(undefined, returnTo\)/);
  assert.match(page, /Back to offers/);
  assert.match(page, /Offer details could not be loaded/);
  assert.match(fallback, /does not reveal private offer records/i);
});

test("agreement payment deep links preserve the exact safe destination through sign-in", async () => {
  const page = await read("src/app/workspace/agreements/[id]/payment/page.tsx");
  assert.match(page, /const returnTo = `\/workspace\/agreements\/\$\{id\}\/payment/);
  assert.match(page, /requireAccount\(undefined, returnTo\)/);
});
