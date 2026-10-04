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

async function edgeCasesSetup() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const a = state.accounts;
  const organizer = await signedIn(a.organizer);
  const supplier = await signedIn(a.supplier);
  const crew = await signedIn(a.crew);
  const results = [];
  const event = must(await organizer.from("events").select("id").order("created_at", { ascending: false }).limit(1).single(), "load organizer event");
  const inventory = must(await supplier.from("inventory_items").select("id,total_quantity").eq("supplier_id", a.supplier.userId).limit(1).single(), "load supplier inventory");
  const supplierBooking = must(await supplier.from("agreements").select("starts_at,ends_at,quantity").eq("provider_role", "supplier").eq("inventory_item_id", inventory.id).limit(1).single(), "load supplier booking");
  const crewBooking = must(await crew.from("agreements").select("starts_at,ends_at").eq("provider_role", "crew").limit(1).single(), "load crew booking");
  const runId = Date.now().toString();

  async function request(role, label, startsAt, endsAt, quantity = 1) {
    const row = must(await organizer.from("requests").insert({
      event_id: event.id, organizer_id: a.organizer.userId, provider_role: role, title: `${label} ${runId}`,
      public_scope: `${label} development verification.`, category: role === "supplier" ? "lighting" : "stage management",
      quantity, quantity_unit: role === "supplier" ? "units" : "shift", pricing_unit: role === "supplier" ? "per booking" : "per shift",
      currency: "TUSD", available_from: startsAt, available_until: endsAt, preparation_deadline: "2027-06-09T09:00:00.000Z",
      cancellation_terms: "Development verification terms.", milestones: ["approval"],
    }).select("id").single(), `create ${label} request`);
    must(await organizer.rpc("publish_request", { p_request_id: row.id }), `publish ${label} request`);
    return row;
  }

  async function offer(actor, role, requestId, label, startsAt, endsAt, quantity = 1, inventoryItemId = null) {
    return must(await actor.rpc("submit_offer", {
      p_request_id: requestId, p_scope: `${label} development verification offer.`, p_quantity: quantity,
      p_pricing_unit: role === "supplier" ? "per booking" : "per shift", p_amount: 300, p_currency: "TUSD",
      p_available_from: startsAt, p_available_until: endsAt, p_preparation_deadline: "2027-06-09T09:00:00.000Z",
      p_cancellation_terms: "Development verification terms.", p_milestones: ["approval"],
      p_inventory_item_id: inventoryItemId, p_idempotency_key: randomUUID(),
    }), `submit ${label} offer`);
  }

  const inventoryQuantity = Number(inventory.total_quantity) - Number(supplierBooking.quantity) + 1;
  const overbookRequest = await request("supplier", "Inventory overbooking", supplierBooking.starts_at, supplierBooking.ends_at, inventoryQuantity);
  const overbookOffer = await offer(supplier, "supplier", overbookRequest.id, "Inventory overbooking", supplierBooking.starts_at, supplierBooking.ends_at, inventoryQuantity, inventory.id);
  const overbook = await organizer.rpc("respond_to_offer", { p_offer_id: overbookOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null });
  results.push(report("capacity:inventory-overbooking-rejected", Boolean(overbook.error) && /inventory capacity/i.test(overbook.error.message), overbook.error?.message));

  const conflictRequest = await request("crew", "Crew conflict", crewBooking.starts_at, crewBooking.ends_at);
  const conflictOffer = await offer(crew, "crew", conflictRequest.id, "Crew conflict", crewBooking.starts_at, crewBooking.ends_at);
  const conflict = await organizer.rpc("respond_to_offer", { p_offer_id: conflictOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null });
  results.push(report("capacity:crew-conflict-rejected", Boolean(conflict.error) && /conflicts/i.test(conflict.error.message), conflict.error?.message));

  const rejectionRequest = await request("supplier", "Offer rejection", "2028-03-01T10:00:00.000Z", "2028-03-01T14:00:00.000Z");
  const rejectionOffer = await offer(supplier, "supplier", rejectionRequest.id, "Offer rejection", "2028-03-01T10:00:00.000Z", "2028-03-01T14:00:00.000Z");
  must(await organizer.rpc("respond_to_offer", { p_offer_id: rejectionOffer.id, p_expected_version: 1, p_action: "reject", p_reason: "The scope no longer fits the event plan." }), "reject offer");
  const rejected = must(await organizer.from("offers").select("status").eq("id", rejectionOffer.id).single(), "load rejected offer");
  results.push(report("offers:rejection", rejected.status === "rejected", rejected));

  const withdrawalRequest = await request("crew", "Offer withdrawal", "2028-04-01T10:00:00.000Z", "2028-04-01T14:00:00.000Z");
  const withdrawalOffer = await offer(crew, "crew", withdrawalRequest.id, "Offer withdrawal", "2028-04-01T10:00:00.000Z", "2028-04-01T14:00:00.000Z");
  must(await crew.rpc("respond_to_offer", { p_offer_id: withdrawalOffer.id, p_expected_version: 1, p_action: "withdraw", p_reason: "The crew member is no longer available." }), "withdraw offer");
  const withdrawn = must(await crew.from("offers").select("status").eq("id", withdrawalOffer.id).single(), "load withdrawn offer");
  results.push(report("offers:withdrawal", withdrawn.status === "withdrawn", withdrawn));

  const expiryRequest = await request("supplier", "Reservation expiry", "2029-05-01T10:00:00.000Z", "2029-05-01T14:00:00.000Z");
  const expiryOffer = await offer(supplier, "supplier", expiryRequest.id, "Reservation expiry", "2029-05-01T10:00:00.000Z", "2029-05-01T14:00:00.000Z");
  must(await organizer.rpc("respond_to_offer", { p_offer_id: expiryOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "create acceptance reservation");
  const reservation = must(await organizer.from("offer_reservations").select("offer_id,expires_at").eq("offer_id", expiryOffer.id).single(), "load acceptance reservation");
  results.push(report("reservations:created", new Date(reservation.expires_at).getTime() > Date.now(), { offerId: expiryOffer.id }));
  state.edgeCases = { reservationOfferId: expiryOffer.id };
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ mode: "edgecases-setup", results, passed: results.length - failed.length, failed: failed.length, reservationOfferId: expiryOffer.id }));
  if (failed.length) process.exitCode = 1;
}

async function edgeCasesExpiry() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const offerId = state.edgeCases?.reservationOfferId;
  if (!offerId) throw new Error("Run edgecases-setup first.");
  const organizer = await signedIn(state.accounts.organizer);
  const supplier = await signedIn(state.accounts.supplier);
  const results = [];
  must(await supplier.rpc("respond_to_offer", { p_offer_id: offerId, p_expected_version: 1, p_action: "accept", p_reason: null }), "accept after expiry");
  const terms = must(await organizer.from("offer_versions").select("organizer_accepted_at,provider_accepted_at").eq("offer_id", offerId).eq("version", 1).single(), "load acceptance state after expiry");
  const premature = must(await organizer.from("agreements").select("id").eq("offer_id", offerId), "check premature agreement");
  results.push(report("reservations:expired-acceptance-cleared", terms.organizer_accepted_at === null && Boolean(terms.provider_accepted_at) && premature.length === 0, terms));
  must(await organizer.rpc("respond_to_offer", { p_offer_id: offerId, p_expected_version: 1, p_action: "accept", p_reason: null }), "reaccept after expiry");
  const agreement = must(await organizer.from("agreements").select("id,status").eq("offer_id", offerId).single(), "load agreement after reacceptance");
  const reservations = must(await organizer.from("offer_reservations").select("offer_id").eq("offer_id", offerId), "check released reservation");
  results.push(report("reservations:released-and-reaccepted", agreement.status === "awaiting_testnet_funding" && reservations.length === 0, agreement));
  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ mode: "edgecases-expiry", results, passed: results.length - failed.length, failed: failed.length }));
  if (failed.length) process.exitCode = 1;
}

async function authEmailProbe() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const result = await client().auth.resetPasswordForEmail(state.accounts.organizer.email, { redirectTo: "http://localhost:3000/auth/confirm?next=/auth/update-password" });
  console.log(JSON.stringify({ mode: "auth-email-probe", accepted: !result.error, errorCode: result.error?.code ?? null, status: result.error?.status ?? null }));
  if (result.error) process.exitCode = 1;
}

const mode = process.argv[2];
if (mode === "provision") await provision();
else if (mode === "verify") await verify();
else if (mode === "edgecases-setup") await edgeCasesSetup();
else if (mode === "edgecases-expiry") await edgeCasesExpiry();
else if (mode === "auth-email-probe") await authEmailProbe();
else throw new Error("Use provision, verify, edgecases-setup, edgecases-expiry, or auth-email-probe.");
