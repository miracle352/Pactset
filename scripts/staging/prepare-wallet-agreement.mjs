import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const appEnvPath = new URL("../../.env.local", import.meta.url);
const identitiesPath = new URL("../../.stage2a-test-state.local.json", import.meta.url);
const statePath = new URL("../../.staging-preview-state.local.json", import.meta.url);

function parseEnvironment(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const appEnv = parseEnvironment(await readFile(appEnvPath, "utf8"));
const identities = JSON.parse(await readFile(identitiesPath, "utf8"));
const url = appEnv.NEXT_PUBLIC_SUPABASE_URL;
const key = appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Pactset development Supabase configuration is missing.");
if (!url.includes("lvpsemqalftvcqkrjsyu")) throw new Error("Refusing to prepare staging data outside pactset-development.");

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(role) {
  const account = identities.accounts[role];
  if (!account) throw new Error(`Missing ${role} development identity.`);
  const supabase = client();
  must(await supabase.auth.signInWithPassword({ email: account.email, password: account.password }), `sign in ${role}`);
  return { account, supabase };
}

let prior = null;
try {
  prior = JSON.parse(await readFile(statePath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const organizer = await signIn("organizer");
if (prior?.agreementId) {
  const agreement = must(
    await organizer.supabase.from("agreements").select("id,status,currency,amount,provider_id").eq("id", prior.agreementId).maybeSingle(),
    "load prior staging agreement",
  );
  if (agreement?.status === "awaiting_testnet_funding") {
    console.log(JSON.stringify({ reused: true, agreement, escrowCreated: false, operatorWalletUsed: false }));
    process.exit(0);
  }
}

const supplier = await signIn("supplier");
const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const event = must(
  await organizer.supabase
    .from("events")
    .insert({
      organizer_id: organizer.account.userId,
      name: `Restricted Preview wallet rehearsal ${suffix}`,
      event_type: "Development rehearsal",
      country_code: "NG",
      city: "Lagos",
      venue_address: "Private development fixture",
      timezone: "Africa/Lagos",
      starts_at: "2027-08-20T10:00:00.000Z",
      ends_at: "2027-08-20T18:00:00.000Z",
      preparation_deadline: "2027-08-19T10:00:00.000Z",
      attendee_count: 40,
      venue_capacity: 60,
      budget_currency: "TUSD",
      contingency_amount: 50,
      spaces: [],
      food_requirements: [],
      equipment_requirements: [],
      crew_requirements: [],
      budget_allocations: [],
    })
    .select("id")
    .single(),
  "create staging event",
);

const request = must(
  await organizer.supabase
    .from("requests")
    .insert({
      event_id: event.id,
      organizer_id: organizer.account.userId,
      provider_role: "supplier",
      title: `Freighter lighting rehearsal ${suffix}`,
      public_scope: "Provide one lighting kit for a private Stellar Testnet payment rehearsal.",
      category: "lighting",
      quantity: 1,
      quantity_unit: "kit",
      pricing_unit: "per booking",
      currency: "TUSD",
      available_from: "2027-08-20T09:00:00.000Z",
      available_until: "2027-08-20T19:00:00.000Z",
      preparation_deadline: "2027-08-19T10:00:00.000Z",
      cancellation_terms: "Development rehearsal only; no real monetary value.",
      milestones: ["Lighting handoff"],
    })
    .select("id")
    .single(),
  "create staging request",
);
must(await organizer.supabase.rpc("publish_request", { p_request_id: request.id }), "publish staging request");

const inventory = must(
  await supplier.supabase
    .from("inventory_items")
    .select("id")
    .eq("supplier_id", supplier.account.userId)
    .eq("category", "lighting")
    .gte("total_quantity", 1)
    .limit(1)
    .maybeSingle(),
  "find supplier inventory",
);

const offer = must(
  await supplier.supabase.rpc("submit_offer", {
    p_request_id: request.id,
    p_scope: "Deliver one lighting kit and provide a private handoff note.",
    p_quantity: 1,
    p_pricing_unit: "per booking",
    p_amount: 5,
    p_currency: "TUSD",
    p_available_from: "2027-08-20T09:00:00.000Z",
    p_available_until: "2027-08-20T19:00:00.000Z",
    p_preparation_deadline: "2027-08-19T10:00:00.000Z",
    p_cancellation_terms: "Development rehearsal only; no real monetary value.",
    p_milestones: ["Lighting handoff"],
    p_inventory_item_id: inventory?.id ?? null,
    p_idempotency_key: randomUUID(),
  }),
  "submit staging offer",
);

must(
  await organizer.supabase.rpc("respond_to_offer", {
    p_offer_id: offer.id,
    p_expected_version: 1,
    p_action: "accept",
    p_reason: null,
  }),
  "organizer accepts staging offer",
);
must(
  await supplier.supabase.rpc("respond_to_offer", {
    p_offer_id: offer.id,
    p_expected_version: 1,
    p_action: "accept",
    p_reason: null,
  }),
  "supplier accepts staging offer",
);

const agreement = must(
  await organizer.supabase
    .from("agreements")
    .select("id,status,currency,amount,organizer_id,provider_id")
    .eq("offer_id", offer.id)
    .single(),
  "load staging agreement",
);
if (agreement.status !== "awaiting_testnet_funding") throw new Error(`Unexpected agreement status ${agreement.status}`);

const state = {
  createdAt: new Date().toISOString(),
  eventId: event.id,
  requestId: request.id,
  offerId: offer.id,
  agreementId: agreement.id,
  settlementAsset: agreement.currency,
  amount: agreement.amount,
  escrowCreated: false,
  operatorWalletUsed: false,
  nextStep: "Organizer and supplier must each verify a distinct Freighter Testnet public key before the developer deploys the agreement-bound escrow.",
};
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await organizer.supabase.auth.signOut();
await supplier.supabase.auth.signOut();
console.log(JSON.stringify({ reused: false, agreement, escrowCreated: false, operatorWalletUsed: false }));
