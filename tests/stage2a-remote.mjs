import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const statePath = new URL("../.stage2a-test-state.local.json", import.meta.url);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const password = () => `${randomBytes(24).toString("base64url")}aA7!`;
const must = (value, label) => {
  if (value.error) throw new Error(`${label}: ${value.error.message}`);
  return value.data;
};
const report = (name, ok, detail) => ({ name, ok, detail });

async function provision() {
  const runId = Date.now().toString();
  const accounts = {};
  const results = [];
  for (const role of ["organizer", "supplier", "crew", "unrelated"]) {
    const email = `pactset.stage2a.${role}.${runId}@gmail.com`;
    const accountPassword = password();
    const result = await client().auth.signUp({
      email,
      password: accountPassword,
      options: { data: { display_name: `Pactset ${role} test` }, emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    if (result.error || !result.data.user) {
      results.push(report(`signup:${role}`, false, result.error?.message ?? "No user returned"));
      continue;
    }
    accounts[role] = { email, password: accountPassword, userId: result.data.user.id };
    results.push(report(`signup:${role}`, true, { userId: result.data.user.id, confirmationRequired: !result.data.session }));
  }
  await writeFile(statePath, JSON.stringify({ runId, accounts }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ mode: "provision", results }));
}

async function signedIn(account) {
  const supabase = client();
  must(await supabase.auth.signInWithPassword({ email: account.email, password: account.password }), `sign in ${account.email}`);
  return supabase;
}

async function verify() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const required = ["organizer", "supplier", "crew", "unrelated"];
  for (const role of required) if (!state.accounts[role]) throw new Error(`Missing provisioned ${role} account.`);
  const a = state.accounts;
  const results = [];

  const organizer = await signedIn(a.organizer);
  results.push(report("auth:login-organizer", true));
  must(await organizer.from("account_roles").insert({ user_id: a.organizer.userId, role: "organizer" }), "organizer role");
  const event = must(await organizer.from("events").insert({
    organizer_id: a.organizer.userId, name: "Stage 2A persistence test", event_type: "Conference",
    country_code: "NG", city: "Lagos", venue_address: "Development fixture venue", timezone: "Africa/Lagos",
    starts_at: "2027-06-10T09:00:00.000Z", ends_at: "2027-06-10T18:00:00.000Z",
    preparation_deadline: "2027-06-09T09:00:00.000Z", attendee_count: 120, venue_capacity: 180,
    budget_currency: "TUSD", contingency_amount: 500, spaces: [], food_requirements: [],
    equipment_requirements: [], crew_requirements: [], budget_allocations: [],
  }).select("id").single(), "create event draft");
  must(await organizer.auth.signOut(), "organizer sign out");
  results.push(report("auth:logout-organizer", true));
  const organizerAgain = await signedIn(a.organizer);
  const resumed = must(await organizerAgain.from("events").select("id,name,status").eq("id", event.id).single(), "resume event draft");
  results.push(report("persistence:draft-after-signin", resumed.status === "draft", resumed));

  const supplierRequest = must(await organizerAgain.from("requests").insert({
    event_id: event.id, organizer_id: a.organizer.userId, provider_role: "supplier", title: "Lighting package",
    public_scope: "Provide and prepare a complete stage lighting package.", category: "lighting", quantity: 6,
    quantity_unit: "units", pricing_unit: "per booking", currency: "TUSD",
    available_from: "2027-06-10T07:00:00.000Z", available_until: "2027-06-10T20:00:00.000Z",
    preparation_deadline: "2027-06-09T09:00:00.000Z", cancellation_terms: "Cancel at least seven days before service.", milestones: ["delivery", "approval"],
  }).select("id").single(), "create supplier request");
  must(await organizerAgain.rpc("publish_request", { p_request_id: supplierRequest.id }), "publish supplier request");

  const supplier = await signedIn(a.supplier);
  must(await supplier.from("account_roles").insert({ user_id: a.supplier.userId, role: "supplier" }), "supplier role");
  must(await supplier.from("provider_profiles").upsert({ user_id: a.supplier.userId, services: ["lighting"], skills: [], pricing_units: ["per booking"] }), "supplier profile");
  const inventory = must(await supplier.from("inventory_items").insert({ supplier_id: a.supplier.userId, name: "Lighting kits", category: "lighting", total_quantity: 10, unit: "kits" }).select("id").single(), "supplier inventory");
  const eligible = must(await supplier.rpc("list_eligible_requests"), "supplier request feed");
  results.push(report("supplier:eligible-request", eligible.some((row) => row.id === supplierRequest.id)));
  const idempotency = randomUUID();
  const submitted = must(await supplier.rpc("submit_offer", {
    p_request_id: supplierRequest.id, p_scope: "Deliver and operate six lighting kits for the event.", p_quantity: 6,
    p_pricing_unit: "per booking", p_amount: 2400, p_currency: "TUSD",
    p_available_from: "2027-06-10T07:00:00.000Z", p_available_until: "2027-06-10T20:00:00.000Z",
    p_preparation_deadline: "2027-06-09T09:00:00.000Z", p_cancellation_terms: "Cancel at least seven days before service.",
    p_milestones: ["delivery", "approval"], p_inventory_item_id: inventory.id, p_idempotency_key: idempotency,
  }), "submit supplier offer");
  const duplicate = must(await supplier.rpc("submit_offer", {
    p_request_id: supplierRequest.id, p_scope: "Deliver and operate six lighting kits for the event.", p_quantity: 6,
    p_pricing_unit: "per booking", p_amount: 2400, p_currency: "TUSD",
    p_available_from: "2027-06-10T07:00:00.000Z", p_available_until: "2027-06-10T20:00:00.000Z",
    p_preparation_deadline: "2027-06-09T09:00:00.000Z", p_cancellation_terms: "Cancel at least seven days before service.",
    p_milestones: ["delivery", "approval"], p_inventory_item_id: inventory.id, p_idempotency_key: idempotency,
  }), "retry supplier offer");
  results.push(report("offers:idempotent-retry", duplicate.id === submitted.id));

  must(await organizerAgain.rpc("counter_offer", {
    p_offer_id: submitted.id, p_expected_version: 1, p_scope: "Deliver and operate six lighting kits with a rehearsal check.",
    p_quantity: 6, p_pricing_unit: "per booking", p_amount: 2250, p_currency: "TUSD",
    p_available_from: "2027-06-10T07:00:00.000Z", p_available_until: "2027-06-10T20:00:00.000Z",
    p_preparation_deadline: "2027-06-09T09:00:00.000Z", p_cancellation_terms: "Cancel at least seven days before service.",
    p_milestones: ["rehearsal", "delivery", "approval"], p_inventory_item_id: inventory.id, p_reason: "Add rehearsal and align the budget.",
  }), "counter supplier offer");
  const stale = await supplier.rpc("respond_to_offer", { p_offer_id: submitted.id, p_expected_version: 1, p_action: "accept", p_reason: null });
  results.push(report("offers:stale-version-rejected", Boolean(stale.error), stale.error?.message));
  const concurrent = await Promise.allSettled([
    organizerAgain.rpc("respond_to_offer", { p_offer_id: submitted.id, p_expected_version: 2, p_action: "accept", p_reason: null }),
    supplier.rpc("respond_to_offer", { p_offer_id: submitted.id, p_expected_version: 2, p_action: "accept", p_reason: null }),
  ]);
  const supplierAgreement = must(await organizerAgain.from("agreements").select("id,status,offer_version,currency,amount").eq("offer_id", submitted.id).single(), "supplier agreement");
  results.push(report("agreement:supplier-concurrent-acceptance", supplierAgreement.status === "awaiting_testnet_funding" && supplierAgreement.offer_version === 2, { concurrent: concurrent.map((x) => x.status), agreement: supplierAgreement }));

  const crewRequest = must(await organizerAgain.from("requests").insert({
    event_id: event.id, organizer_id: a.organizer.userId, provider_role: "crew", title: "Stage manager shift",
    public_scope: "Coordinate stage cues, preparation, and event-time handoffs.", category: "stage management", quantity: 1,
    quantity_unit: "shift", pricing_unit: "per shift", currency: "TUSD",
    available_from: "2027-06-10T08:00:00.000Z", available_until: "2027-06-10T19:00:00.000Z",
    preparation_deadline: "2027-06-09T09:00:00.000Z", cancellation_terms: "Cancel at least seven days before the shift.", milestones: ["briefing", "shift", "handoff"],
  }).select("id").single(), "create crew request");
  must(await organizerAgain.rpc("publish_request", { p_request_id: crewRequest.id }), "publish crew request");
  const crew = await signedIn(a.crew);
  must(await crew.from("account_roles").insert({ user_id: a.crew.userId, role: "crew" }), "crew role");
  must(await crew.from("provider_profiles").upsert({ user_id: a.crew.userId, services: [], skills: ["stage management"], pricing_units: ["per shift"] }), "crew profile");
  const crewOffer = must(await crew.rpc("submit_offer", {
    p_request_id: crewRequest.id, p_scope: "Lead stage cues, briefing, and event handoff for the full shift.", p_quantity: 1,
    p_pricing_unit: "per shift", p_amount: 420, p_currency: "TUSD",
    p_available_from: "2027-06-10T08:00:00.000Z", p_available_until: "2027-06-10T19:00:00.000Z",
    p_preparation_deadline: "2027-06-09T09:00:00.000Z", p_cancellation_terms: "Cancel at least seven days before the shift.",
    p_milestones: ["briefing", "shift", "handoff"], p_inventory_item_id: null, p_idempotency_key: randomUUID(),
  }), "submit crew offer");
  must(await organizerAgain.rpc("respond_to_offer", { p_offer_id: crewOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "organizer accepts crew offer");
  must(await crew.rpc("respond_to_offer", { p_offer_id: crewOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "crew accepts offer");
  const crewAgreement = must(await crew.from("agreements").select("id,status").eq("offer_id", crewOffer.id).single(), "crew agreement");
  results.push(report("agreement:crew", crewAgreement.status === "awaiting_testnet_funding", crewAgreement));

  const unrelated = await signedIn(a.unrelated);
  const privateRead = must(await unrelated.from("events").select("id").eq("id", event.id), "unrelated private read");
  const privateUpdate = must(await unrelated.from("events").update({ name: "Unauthorized" }).eq("id", event.id).select("id"), "unrelated private update");
  const supportEscalation = await unrelated.from("account_roles").insert({ user_id: a.unrelated.userId, role: "support" });
  results.push(report("authorization:private-draft-hidden", privateRead.length === 0));
  results.push(report("authorization:private-update-rejected", privateUpdate.length === 0));
  results.push(report("authorization:support-self-assignment-rejected", Boolean(supportEscalation.error), supportEscalation.error?.message));

  await organizerAgain.auth.signOut(); await supplier.auth.signOut(); await crew.auth.signOut(); await unrelated.auth.signOut();
  const organizerFinal = await signedIn(a.organizer);
  const persistedAgreement = must(await organizerFinal.from("agreements").select("id,status").eq("id", supplierAgreement.id).single(), "agreement after re-sign-in");
  results.push(report("persistence:agreement-after-signin", persistedAgreement.status === "awaiting_testnet_funding", persistedAgreement));

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ mode: "verify", results, passed: results.length - failed.length, failed: failed.length, blocked: ["auth:email-confirmation-link", "auth:password-recovery-email-link"] }));
  if (failed.length) process.exitCode = 1;
}

const mode = process.argv[2];
if (mode === "provision") await provision();
else if (mode === "verify") await verify();
else throw new Error("Use provision or verify.");
