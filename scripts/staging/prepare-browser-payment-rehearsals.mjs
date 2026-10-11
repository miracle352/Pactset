import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const appEnvPath = new URL("../../.env.local", import.meta.url);
const identitiesPath = new URL("../../.stage2a-test-state.local.json", import.meta.url);
const statePath = new URL("../../.browser-payment-rehearsals.local.json", import.meta.url);

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const environment = parseEnvironment(await readFile(appEnvPath, "utf8"));
const identities = JSON.parse(await readFile(identitiesPath, "utf8"));
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !url.includes("lvpsemqalftvcqkrjsyu")) throw new Error("Refusing to prepare rehearsals outside pactset-development.");

function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signIn(role) {
  const account = identities.accounts[role];
  if (!account) throw new Error(`Missing ${role} development identity.`);
  const supabase = client();
  must(await supabase.auth.signInWithPassword({ email: account.email, password: account.password }), `sign in ${role}`);
  return { account, supabase };
}

let prior = { agreements: [] };
try { prior = JSON.parse(await readFile(statePath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }

const organizer = await signIn("organizer");
const supplier = await signIn("supplier");
const reusable = [];
for (const item of prior.agreements ?? []) {
  const agreement = must(await organizer.supabase.from("agreements").select("id,status,currency,amount,provider_id").eq("id", item.agreementId).maybeSingle(), "load prior rehearsal agreement");
  const escrow = agreement ? must(await organizer.supabase.from("agreement_escrows").select("id,status").eq("agreement_id", agreement.id).maybeSingle(), "load prior rehearsal escrow") : null;
  if (agreement?.status === "awaiting_testnet_funding" && !escrow) reusable.push({ ...item, amount: agreement.amount });
}

const requested = [
  { currency: "TUSD", amount: 5, day: 20, label: "Fresh browser Freighter TUSD rehearsal" },
  { currency: "TEUR", amount: 4, day: 22, label: "Fresh browser Freighter TEUR rehearsal" },
];
const agreements = [];

for (const fixture of requested) {
  const existing = reusable.find((item) => item.currency === fixture.currency);
  if (existing) { agreements.push(existing); continue; }
  const suffix = `${fixture.currency}-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const start = `2027-09-${fixture.day}T10:00:00.000Z`;
  const end = `2027-09-${fixture.day}T18:00:00.000Z`;
  const prep = `2027-09-${fixture.day - 1}T10:00:00.000Z`;
  const event = must(await organizer.supabase.from("events").insert({
    organizer_id: organizer.account.userId, name: fixture.label, event_type: "Private development rehearsal", country_code: "NG", city: "Lagos",
    venue_address: "Private development fixture", timezone: "Africa/Lagos", starts_at: start, ends_at: end, preparation_deadline: prep,
    attendee_count: 40, venue_capacity: 60, budget_currency: fixture.currency, contingency_amount: 10,
    spaces: [], food_requirements: [], equipment_requirements: [], crew_requirements: [], budget_allocations: [],
  }).select("id").single(), `create ${fixture.currency} event`);
  const request = must(await organizer.supabase.from("requests").insert({
    event_id: event.id, organizer_id: organizer.account.userId, provider_role: "supplier", title: `${fixture.label} ${suffix}`,
    public_scope: "Provide one lighting kit for a private Stellar Testnet payment rehearsal.", category: "lighting", quantity: 1,
    quantity_unit: "kit", pricing_unit: "per booking", currency: fixture.currency, available_from: start, available_until: end,
    preparation_deadline: prep, cancellation_terms: "Development rehearsal only; Testnet assets have no real monetary value.", milestones: ["Lighting handoff"],
  }).select("id").single(), `create ${fixture.currency} request`);
  must(await organizer.supabase.rpc("publish_request", { p_request_id: request.id }), `publish ${fixture.currency} request`);
  const inventory = must(await supplier.supabase.from("inventory_items").select("id").eq("supplier_id", supplier.account.userId).eq("category", "lighting").gte("total_quantity", 1).limit(1).maybeSingle(), "find supplier inventory");
  const offer = must(await supplier.supabase.rpc("submit_offer", {
    p_request_id: request.id, p_scope: `Deliver one lighting kit for the ${fixture.currency} browser rehearsal.`, p_quantity: 1,
    p_pricing_unit: "per booking", p_amount: fixture.amount, p_currency: fixture.currency, p_available_from: start, p_available_until: end,
    p_preparation_deadline: prep, p_cancellation_terms: "Development rehearsal only; Testnet assets have no real monetary value.",
    p_milestones: ["Lighting handoff"], p_inventory_item_id: inventory?.id ?? null, p_idempotency_key: randomUUID(),
  }), `submit ${fixture.currency} offer`);
  must(await organizer.supabase.rpc("respond_to_offer", { p_offer_id: offer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), `organizer accepts ${fixture.currency} offer`);
  must(await supplier.supabase.rpc("respond_to_offer", { p_offer_id: offer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), `supplier accepts ${fixture.currency} offer`);
  const agreement = must(await organizer.supabase.from("agreements").select("id,status,currency,amount,organizer_id,provider_id").eq("offer_id", offer.id).single(), `load ${fixture.currency} agreement`);
  agreements.push({ currency: fixture.currency, amount: agreement.amount, eventId: event.id, requestId: request.id, offerId: offer.id, agreementId: agreement.id });
}

const state = {
  preparedAt: new Date().toISOString(), network: "TESTNET", agreements,
  signingMode: "participant Freighter wallets required; no operator transaction signing",
  nextStep: "Organizer and supplier each verify a distinct Freighter Testnet wallet. Organizer then opens the agreement payment route and selects Create escrow.",
};
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await organizer.supabase.auth.signOut();
await supplier.supabase.auth.signOut();
console.log(JSON.stringify({ network: state.network, agreements, operatorWalletUsed: false, browserExtensionSigned: false, credentialsPrinted: false }, null, 2));
