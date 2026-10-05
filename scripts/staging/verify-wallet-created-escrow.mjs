import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const envText = await readFile(new URL("../../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const stellar = JSON.parse(await readFile(new URL("../../.stellar-testnet.local.json", import.meta.url), "utf8"));
const stateUrl = new URL("../../.wallet-escrow-test.local.json", import.meta.url);
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes("lvpsemqalftvcqkrjsyu") || stellar.network !== "TESTNET") throw new Error("Refusing to test outside pactset-development and Stellar Testnet");

const makeClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(role) {
  const client = makeClient();
  const result = await client.auth.signInWithPassword({ email: identities.accounts[role].email, password: identities.accounts[role].password });
  if (result.error) throw result.error;
  return client;
}
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
async function invoke(client, body) {
  const result = await client.functions.invoke("stellar-payments", { body });
  if (result.error) {
    let detail = result.error.message;
    try { detail = JSON.stringify(await result.error.context?.clone().json()); } catch {}
    throw new Error(`stellar-payments: ${detail}`);
  }
  return result.data;
}

let checkpoint = null;
try { checkpoint = JSON.parse(await readFile(stateUrl, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const organizer = await signedIn("organizer");
const supplier = await signedIn("supplier");
const support = await signedIn("support");
const unrelated = await signedIn("unrelated");

let agreementId = checkpoint?.agreementId;
if (!agreementId) {
  const event = must(await organizer.from("events").select("id").order("created_at", { ascending: false }).limit(1).single(), "load organizer event");
  const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const request = must(await organizer.from("requests").insert({ event_id: event.id, organizer_id: identities.accounts.organizer.userId, provider_role: "supplier", title: `Wallet-created escrow verification ${suffix}`, public_scope: "Provide one fixture item for wallet-authorized Testnet escrow creation verification.", category: "verification", quantity: 1, quantity_unit: "item", pricing_unit: "fixed total", currency: "TUSD", available_from: "2029-08-20T09:00:00.000Z", available_until: "2029-08-20T12:00:00.000Z", preparation_deadline: "2029-08-19T09:00:00.000Z", cancellation_terms: "Development Testnet verification only; no real monetary value.", milestones: ["Verified handoff"] }).select("id").single(), "create request");
  must(await organizer.rpc("publish_request", { p_request_id: request.id }), "publish request");
  const offer = must(await supplier.rpc("submit_offer", { p_request_id: request.id, p_scope: "Complete one verified handoff for the Testnet escrow creation check.", p_quantity: 1, p_pricing_unit: "fixed total", p_amount: 7, p_currency: "TUSD", p_available_from: "2029-08-20T09:00:00.000Z", p_available_until: "2029-08-20T12:00:00.000Z", p_preparation_deadline: "2029-08-19T09:00:00.000Z", p_cancellation_terms: "Development Testnet verification only; no real monetary value.", p_milestones: ["Verified handoff"], p_inventory_item_id: null, p_idempotency_key: randomUUID() }), "submit offer");
  must(await organizer.rpc("respond_to_offer", { p_offer_id: offer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "organizer acceptance");
  const accepted = must(await supplier.rpc("respond_to_offer", { p_offer_id: offer.id, p_expected_version: 1, p_action: "accept", p_reason: null }), "supplier acceptance");
  agreementId = accepted.agreement_id;
  checkpoint = { agreementId, idempotencyKey: `create-escrow-${randomUUID()}` };
  await writeFile(stateUrl, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 });
}

let escrow = must(await organizer.from("agreement_escrows").select("id,contract_address,deployment_tx_hash,payer_public_key,payee_public_key,resolver_public_key").eq("agreement_id", agreementId).maybeSingle(), "load escrow");
if (!escrow) {
  const prepared = await invoke(organizer, { action: "prepare", agreementId, transactionAction: "create_escrow", idempotencyKey: checkpoint.idempotencyKey });
  const transaction = TransactionBuilder.fromXDR(prepared.xdr, Networks.TESTNET);
  transaction.sign(Keypair.fromSecret(stellar.accounts.organizer.secret));
  let submitted = await invoke(organizer, { action: "submit", agreementId, transactionId: prepared.transaction.id, signedXdr: transaction.toXDR() });
  for (let index = 0; index < 10 && submitted.transaction?.status === "pending"; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await invoke(organizer, { action: "reconcile" });
    submitted = { transaction: must(await organizer.from("payment_transactions").select("status,tx_hash").eq("id", prepared.transaction.id).single(), "reload deployment") };
  }
  if (submitted.transaction?.status !== "confirmed") throw new Error(`Escrow deployment did not confirm: ${submitted.transaction?.status}`);
  escrow = must(await organizer.from("agreement_escrows").select("id,contract_address,deployment_tx_hash,payer_public_key,payee_public_key,resolver_public_key").eq("agreement_id", agreementId).single(), "load confirmed escrow");
}

const duplicate = await invoke(organizer, { action: "prepare", agreementId, transactionAction: "create_escrow", idempotencyKey: `duplicate-${randomUUID()}` });
if (!duplicate.alreadyCreated || duplicate.escrow.contract_address !== escrow.contract_address) throw new Error("Duplicate escrow prevention failed");
const supportCase = must(await organizer.rpc("open_support_case", { p_agreement_id: agreementId, p_reason: "Verify assigned-case visibility without granting broad support access." }), "open support case");
must(await organizer.rpc("add_support_case_message", { p_case_id: supportCase.id, p_body: "Organizer provided the agreement context for this private verification case.", p_evidence_id: null }), "organizer case message");
must(await support.rpc("add_support_case_message", { p_case_id: supportCase.id, p_body: "Assigned support can see this case, but on-chain resolution still requires the disclosed wallet.", p_evidence_id: null }), "support case message");
const [supportVisible, unrelatedCases, unrelatedAgreement, events] = await Promise.all([
  support.from("support_cases").select("id,agreement_id,assigned_support_id,status").eq("id", supportCase.id).single(),
  unrelated.from("support_cases").select("id").eq("id", supportCase.id),
  unrelated.from("agreements").select("id").eq("id", agreementId),
  support.from("support_case_events").select("action").eq("case_id", supportCase.id),
]);
if (supportVisible.error || supportVisible.data.assigned_support_id !== identities.accounts.support.userId) throw new Error("Assigned support visibility failed");
if (unrelatedCases.error || unrelatedCases.data.length || unrelatedAgreement.error || unrelatedAgreement.data.length) throw new Error("Unrelated access denial failed");
if (events.error || events.data.length < 4) throw new Error("Support audit trail is incomplete");

for (const client of [organizer, supplier, support, unrelated]) await client.auth.signOut();
console.log(JSON.stringify({ network: "TESTNET", agreementId, contractAddress: escrow.contract_address, deploymentTransactionHash: escrow.deployment_tx_hash, duplicatePrevented: true, assignedCaseId: supportCase.id, assignedSupportScoped: true, unrelatedDenied: true, browserWalletSigning: false, fixtureSigningOnly: true, secretsPrinted: false }, null, 2));
