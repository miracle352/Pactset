import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const stateUrl = new URL("../../.stage2a-test-state.local.json", import.meta.url);
const localEnvironment = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnvironment.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? localEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");

const state = JSON.parse(await readFile(stateUrl, "utf8"));
const accounts = state.accounts;
for (const name of ["organizer", "supplier", "crew2", "support"]) {
  if (!accounts?.[name]) throw new Error(`Missing ${name} development identity.`);
}

const create = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(account) {
  const client = create();
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`Could not sign in ${account.userId}: ${error.message}`);
  return client;
}
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
const row = (name, ok, details = {}) => ({ name, ok, details });
const results = [];
const run = `capacity-race-${Date.now()}`;

const organizer = await signedIn(accounts.organizer);
const organizerRaceA = await signedIn(accounts.organizer);
const organizerRaceB = await signedIn(accounts.organizer);
const crew = await signedIn(accounts.crew2);
const crewRace = await signedIn(accounts.crew2);
const supplier = await signedIn(accounts.supplier);
const supplierRace = await signedIn(accounts.supplier);
const support = await signedIn(accounts.support);

await crew.from("provider_profiles").upsert({
  user_id: accounts.crew2.userId,
  services: [],
  skills: ["capacity-race-crew"],
  pricing_units: ["per shift"],
});

const event = must(await organizer.from("events").insert({
  organizer_id: accounts.organizer.userId,
  name: `Isolated concurrency verification ${run}`,
  event_type: "Development verification",
  country_code: "NG",
  city: "Lagos",
  timezone: "Africa/Lagos",
  starts_at: "2032-07-21T08:00:00.000Z",
  ends_at: "2032-07-22T23:00:00.000Z",
  preparation_deadline: "2032-07-20T08:00:00.000Z",
  attendee_count: 10,
  venue_capacity: 20,
  budget_currency: "TUSD",
  contingency_amount: 0,
  spaces: [], food_requirements: [], equipment_requirements: {}, crew_requirements: [], budget_allocations: [],
}).select("id").single(), "create isolated event");

async function createRequest({ role, title, category, quantity, unit, pricing, start, end, setup = 0, teardown = 0 }) {
  const request = must(await organizer.from("requests").insert({
    event_id: event.id,
    organizer_id: accounts.organizer.userId,
    provider_role: role,
    status: "draft",
    title: `${title} ${run}`,
    public_scope: `${title} isolated concurrent verification record.`,
    category,
    quantity,
    quantity_unit: unit,
    pricing_unit: pricing,
    currency: "TUSD",
    available_from: start,
    available_until: end,
    preparation_deadline: "2032-07-20T08:00:00.000Z",
    cancellation_terms: "Development verification only.",
    milestones: ["verification"],
    setup_minutes: setup,
    teardown_minutes: teardown,
  }).select("id").single(), `create ${title}`);
  must(await organizer.rpc("publish_request", { p_request_id: request.id }), `publish ${title}`);
  return request;
}

async function createOffer(client, { request, role, quantity, pricing, start, end, inventory = null, setup = 0, teardown = 0 }) {
  const result = await client.rpc("submit_offer", {
    p_request_id: request.id,
    p_scope: `Isolated ${role} concurrency verification.`,
    p_quantity: quantity,
    p_pricing_unit: pricing,
    p_amount: 100,
    p_currency: "TUSD",
    p_available_from: start,
    p_available_until: end,
    p_preparation_deadline: new Date(Date.parse(start) - 86_400_000).toISOString(),
    p_cancellation_terms: "Development verification only.",
    p_milestones: ["verification"],
    p_inventory_item_id: inventory,
    p_idempotency_key: randomUUID(),
    p_setup_minutes: setup,
    p_teardown_minutes: teardown,
  });
  return must(result, `submit ${role} offer`);
}

async function acceptRace(offerA, offerB) {
  const [a, b] = await Promise.all([
    organizerRaceA.rpc("respond_to_offer", { p_offer_id: offerA.id, p_expected_version: 1, p_action: "accept", p_reason: null }),
    organizerRaceB.rpc("respond_to_offer", { p_offer_id: offerB.id, p_expected_version: 1, p_action: "accept", p_reason: null }),
  ]);
  return [a, b];
}

const slot = Number(BigInt(Date.now()) % BigInt(100 * 365 * 48));
const base = Date.UTC(2100, 0, 1) + slot * 30 * 60 * 1000;
const at = (minutes) => new Date(base + minutes * 60 * 1000).toISOString();
const crewStart = at(0);
const crewEnd = at(120);
const crewRequestA = await createRequest({ role: "crew", title: "Crew race A", category: "capacity-race-crew", quantity: 1, unit: "shift", pricing: "per shift", start: crewStart, end: crewEnd, setup: 30, teardown: 30 });
const crewRequestB = await createRequest({ role: "crew", title: "Crew race B", category: "capacity-race-crew", quantity: 1, unit: "shift", pricing: "per shift", start: crewStart, end: crewEnd, setup: 30, teardown: 30 });
const crewOfferA = await createOffer(crew, { request: crewRequestA, role: "crew", quantity: 1, pricing: "per shift", start: crewStart, end: crewEnd, setup: 30, teardown: 30 });
const crewOfferB = await createOffer(crewRace, { request: crewRequestB, role: "crew", quantity: 1, pricing: "per shift", start: crewStart, end: crewEnd, setup: 30, teardown: 30 });
const crewRaceResults = await acceptRace(crewOfferA, crewOfferB);
const crewSucceeded = crewRaceResults.filter((item) => !item.error);
const crewFailed = crewRaceResults.filter((item) => item.error);
results.push(row("crew:simultaneous-capacity-one", crewSucceeded.length === 1 && crewFailed.length === 1 && /conflicts/i.test(crewFailed[0].error.message), { succeeded: crewSucceeded.length, rejected: crewFailed.length }));
const crewWinner = crewRaceResults[0].error ? crewOfferB : crewOfferA;
must(await crew.rpc("respond_to_offer", { p_offer_id: crewWinner.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "complete winning crew agreement");
const crewAgreements = must(await organizer.from("agreements").select("id,offer_id,starts_at,ends_at").in("offer_id", [crewOfferA.id, crewOfferB.id]), "load crew race agreements");
results.push(row("crew:final-persisted-single-booking", crewAgreements.length === 1 && crewAgreements[0].offer_id === crewWinner.id, { agreements: crewAgreements.length }));

const duplicateResults = await Promise.all([
  organizerRaceA.rpc("respond_to_offer", { p_offer_id: crewWinner.id, p_expected_version: 1, p_action: "accept", p_reason: null }),
  crewRace.rpc("respond_to_offer", { p_offer_id: crewWinner.id, p_expected_version: 1, p_action: "accept", p_reason: null }),
]);
const duplicateAgreements = must(await organizer.from("agreements").select("id").eq("offer_id", crewWinner.id), "load duplicate-protected agreement");
results.push(row("crew:retry-does-not-duplicate", duplicateResults.every((item) => item.error) && duplicateAgreements.length === 1, { agreements: duplicateAgreements.length }));

const touchingRequest = await createRequest({ role: "crew", title: "Crew buffer boundary", category: "capacity-race-crew", quantity: 1, unit: "shift", pricing: "per shift", start: at(150), end: at(210) });
const touchingOffer = await createOffer(crew, { request: touchingRequest, role: "crew", quantity: 1, pricing: "per shift", start: at(150), end: at(210) });
const touchingAcceptance = await organizer.rpc("respond_to_offer", { p_offer_id: touchingOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null });
results.push(row("crew:back-to-back-half-open-boundary-allowed", !touchingAcceptance.error));

const bufferRequest = await createRequest({ role: "crew", title: "Crew teardown overlap", category: "capacity-race-crew", quantity: 1, unit: "shift", pricing: "per shift", start: at(149), end: at(210) });
const bufferOffer = await createOffer(crewRace, { request: bufferRequest, role: "crew", quantity: 1, pricing: "per shift", start: at(149), end: at(210) });
const bufferAcceptance = await organizer.rpc("respond_to_offer", { p_offer_id: bufferOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null });
results.push(row("crew:teardown-buffer-blocks-one-minute-overlap", Boolean(bufferAcceptance.error) && /conflicts/i.test(bufferAcceptance.error.message)));

const inventory = must(await supplier.from("inventory_items").insert({
  supplier_id: accounts.supplier.userId,
  name: `Capacity-three inventory ${run}`,
  category: "capacity-race-equipment",
  total_quantity: 3,
  unit: "units",
}).select("id,total_quantity").single(), "create capacity-three inventory");
const supplierStart = at(1_440);
const supplierEnd = at(1_680);
const supplierRequestA = await createRequest({ role: "supplier", title: "Supplier race A", category: "capacity-race-equipment", quantity: 2, unit: "units", pricing: "per booking", start: supplierStart, end: supplierEnd });
const supplierRequestB = await createRequest({ role: "supplier", title: "Supplier race B", category: "capacity-race-equipment", quantity: 2, unit: "units", pricing: "per booking", start: supplierStart, end: supplierEnd });
const supplierOfferA = await createOffer(supplier, { request: supplierRequestA, role: "supplier", quantity: 2, pricing: "per booking", start: supplierStart, end: supplierEnd, inventory: inventory.id });
const supplierOfferB = await createOffer(supplierRace, { request: supplierRequestB, role: "supplier", quantity: 2, pricing: "per booking", start: supplierStart, end: supplierEnd, inventory: inventory.id });
const supplierRaceResults = await acceptRace(supplierOfferA, supplierOfferB);
const supplierSucceeded = supplierRaceResults.filter((item) => !item.error);
const supplierFailed = supplierRaceResults.filter((item) => item.error);
results.push(row("supplier:simultaneous-capacity-n", supplierSucceeded.length === 1 && supplierFailed.length === 1 && /capacity/i.test(supplierFailed[0].error.message), { capacity: inventory.total_quantity, succeeded: supplierSucceeded.length, rejected: supplierFailed.length }));
const supplierWinner = supplierRaceResults[0].error ? supplierOfferB : supplierOfferA;
must(await supplier.rpc("respond_to_offer", { p_offer_id: supplierWinner.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "complete winning supplier agreement");

const fillRequest = await createRequest({ role: "supplier", title: "Supplier capacity fill", category: "capacity-race-equipment", quantity: 1, unit: "units", pricing: "per booking", start: supplierStart, end: supplierEnd });
const fillOffer = await createOffer(supplier, { request: fillRequest, role: "supplier", quantity: 1, pricing: "per booking", start: supplierStart, end: supplierEnd, inventory: inventory.id });
must(await organizer.rpc("respond_to_offer", { p_offer_id: fillOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "organizer fills remaining supplier capacity");
must(await supplier.rpc("respond_to_offer", { p_offer_id: fillOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "supplier fills remaining capacity");
const persistedSupplier = must(await organizer.from("agreements").select("id,quantity").eq("inventory_item_id", inventory.id), "load supplier commitments");
const used = persistedSupplier.reduce((sum, agreement) => sum + Number(agreement.quantity), 0);
results.push(row("supplier:persisted-capacity-never-exceeded", used === 3, { capacity: 3, used, agreements: persistedSupplier.length }));

const releaseRequest = await createRequest({ role: "supplier", title: "Reservation release", category: "capacity-race-equipment", quantity: 1, unit: "units", pricing: "per booking", start: at(2_880), end: at(3_000) });
const releaseOffer = await createOffer(supplier, { request: releaseRequest, role: "supplier", quantity: 1, pricing: "per booking", start: at(2_880), end: at(3_000), inventory: inventory.id });
must(await organizer.rpc("respond_to_offer", { p_offer_id: releaseOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "reserve release-test capacity");
must(await supplier.rpc("respond_to_offer", { p_offer_id: releaseOffer.id, p_expected_version: 1, p_action: "withdraw", p_reason: "Release isolated verification capacity." }), "withdraw reservation");
const releasedReservations = must(await organizer.from("offer_reservations").select("offer_id").eq("offer_id", releaseOffer.id), "load released reservations");
results.push(row("reservations:valid-withdrawal-releases-capacity", releasedReservations.length === 0, { reservations: releasedReservations.length }));

const expiryRequest = await createRequest({ role: "supplier", title: "Fresh reservation expiry", category: "capacity-race-equipment", quantity: 1, unit: "units", pricing: "per booking", start: at(4_320), end: at(4_440) });
const expiryOffer = await createOffer(supplier, { request: expiryRequest, role: "supplier", quantity: 1, pricing: "per booking", start: at(4_320), end: at(4_440), inventory: inventory.id });
must(await organizer.rpc("respond_to_offer", { p_offer_id: expiryOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "reserve fresh expiry-test capacity");
must(await support.rpc("expire_isolated_capacity_test_reservation", { p_offer_id: expiryOffer.id }), "expire isolated development reservation");
const providerAfterExpiry = must(await supplier.rpc("respond_to_offer", { p_offer_id: expiryOffer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "provider response after reservation expiry");
const expiryState = must(await organizer.from("offer_versions").select("organizer_accepted_at,provider_accepted_at").eq("offer_id", expiryOffer.id).eq("version", 1).single(), "load expired offer state");
const expiryAgreements = must(await organizer.from("agreements").select("id").eq("offer_id", expiryOffer.id), "load expired offer agreements");
const renewedReservations = must(await organizer.from("offer_reservations").select("offer_id,expires_at").eq("offer_id", expiryOffer.id), "load renewed reservation");
results.push(row("reservations:expired-release-and-stale-acceptance", providerAfterExpiry && expiryState.organizer_accepted_at === null && expiryState.provider_accepted_at !== null && expiryAgreements.length === 0 && renewedReservations.length === 1, { agreements: expiryAgreements.length, renewedReservations: renewedReservations.length }));

const failures = results.filter((item) => !item.ok);
console.log(JSON.stringify({ run, results, passed: results.length - failures.length, failed: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
