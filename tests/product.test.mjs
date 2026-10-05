import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("landing preserves approved headline and actions", async () => {
  const source = await read("src/app/page.tsx");
  assert.match(source, /Every detail\./);
  assert.match(source, /One shared plan\./);
  assert.match(source, /Plan an event/);
  assert.match(source, /Explore demo/);
});

test("public onboarding excludes support from selectable roles", async () => {
  const source = await read("src/app/onboarding/page.tsx");
  const selectable = source.slice(source.indexOf("const choices"), source.indexOf("export default"));
  assert.doesNotMatch(selectable, /name: "Support"/);
  assert.match(source, /Support is assigned, not self-selected/);
  assert.match(source, /Explore each role using sample event data\./);
  assert.match(source, /Explore \{name\.toLowerCase\(\)\} demo/);
  assert.doesNotMatch(source, /Preview \{name\.toLowerCase\(\)\} shell/);
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

test("pavilion fallback is scenery-only and not represented as interactive 3D", async () => {
  const source = await read("src/components/pavilion/pavilion-scene.tsx");
  assert.match(source, /pavilion-light\.webp/);
  assert.match(source, /pavilion-dark\.webp/);
  assert.doesNotMatch(source, /interactive 3D|temporary label|browser frame/i);
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
