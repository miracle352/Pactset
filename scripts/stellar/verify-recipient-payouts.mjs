import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";

const agreementId = "342466d3-c812-4dcb-ad12-9d9f373a70d4";
const parseEnvironment = (source) => Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1)];
}));
const environment = parseEnvironment(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const authFixtures = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const stellarSecrets = JSON.parse(await readFile(new URL("../../.stellar-testnet.local.json", import.meta.url), "utf8"));
const publicStateUrl = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const publicState = JSON.parse(await readFile(publicStateUrl, "utf8"));
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || stellarSecrets.network !== "TESTNET") throw new Error("Missing Testnet development configuration");

async function signIn(role) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = authFixtures.accounts[role];
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw new Error(`Could not sign in ${role}`);
  return { client, token: data.session.access_token };
}
async function call(token, body, expected = 200) {
  const response = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (response.status !== expected) throw new Error(`${body.action}/${body.transactionAction ?? ""} returned ${response.status}: ${data.error ?? data.code ?? "unknown"}`);
  return data;
}
async function prepareSignSubmit(token, keypair, transactionAction, extra = {}) {
  const prepared = await call(token, { action: "prepare", agreementId, transactionAction, idempotencyKey: `${transactionAction}-${crypto.randomUUID()}`, ...extra });
  const transaction = TransactionBuilder.fromXDR(prepared.xdr, Networks.TESTNET);
  transaction.sign(keypair);
  let submitted = await call(token, { action: "submit", agreementId, transactionId: prepared.transaction.id, signedXdr: transaction.toXDR() });
  for (let attempt = 0; submitted.transaction?.status === "pending" && attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const reconciled = await call(token, { action: "reconcile" });
    const match = reconciled.reconciled?.find((item) => item.id === prepared.transaction.id);
    if (match) submitted.transaction = match;
  }
  if (submitted.transaction?.status !== "confirmed") throw new Error(`${transactionAction} did not confirm`);
  return { hash: submitted.transaction.tx_hash, ledger: submitted.transaction.ledger };
}

const supplierSession = await signIn("supplier");
const organizerSession = await signIn("organizer");
const supplier = Keypair.fromSecret(stellarSecrets.accounts.supplier.secret);
const { data: existing } = await supplierSession.client.from("payment_transactions").select("kind,tx_hash,ledger,action_metadata").eq("agreement_id", agreementId).eq("initiated_by", authFixtures.accounts.supplier.userId).eq("kind", "recipient_conversion").eq("status", "confirmed");
const results = { agreementId, conversions: {}, sandbox: {}, authorization: {} };

for (const targetAssetCode of ["XLM", "TEUR"]) {
  const prior = existing?.find((item) => String(item.action_metadata?.outputAsset ?? "").startsWith(targetAssetCode));
  if (prior) {
    results.conversions[targetAssetCode] = { hash: prior.tx_hash, ledger: prior.ledger, resumed: true };
    continue;
  }
  let quoteResponse = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${supplierSession.token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ action: "recipientQuote", agreementId, amount: "1.0000000", targetAssetCode }) });
  let quoteBody = await quoteResponse.json();
  let trustline = null;
  if (quoteResponse.status === 409 && quoteBody.requiresTrustline) {
    trustline = await prepareSignSubmit(supplierSession.token, supplier, "recipient_change_trust", { targetAssetCode });
    quoteBody = await call(supplierSession.token, { action: "recipientQuote", agreementId, amount: "1.0000000", targetAssetCode });
  } else if (!quoteResponse.ok) throw new Error(`${targetAssetCode} recipient quote failed: ${quoteBody.error ?? quoteBody.code}`);
  const conversion = await prepareSignSubmit(supplierSession.token, supplier, "recipient_convert", { quoteId: quoteBody.quote.id });
  results.conversions[targetAssetCode] = { trustline, quote: quoteBody.quote, ...conversion, resumed: false };
}

const sandboxKey = `sandbox-withdrawal-${agreementId}`;
const sandboxFirst = await call(supplierSession.token, { action: "sandboxWithdrawal", agreementId, amount: "1.0000000", destinationLabel: "Fictional NGN rehearsal destination", idempotencyKey: sandboxKey });
const sandboxRetry = await call(supplierSession.token, { action: "sandboxWithdrawal", agreementId, amount: "1.0000000", destinationLabel: "Fictional NGN rehearsal destination", idempotencyKey: sandboxKey });
results.sandbox = { id: sandboxFirst.withdrawal.id, sameIdOnRetry: sandboxFirst.withdrawal.id === sandboxRetry.withdrawal.id, status: sandboxFirst.withdrawal.status, disclosure: sandboxFirst.withdrawal.disclosure };

const denied = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${organizerSession.token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ action: "recipientQuote", agreementId, amount: "1.0000000", targetAssetCode: "XLM" }) });
results.authorization.organizerRecipientQuoteDenied = denied.status === 403;
if (!results.sandbox.sameIdOnRetry || !results.authorization.organizerRecipientQuoteDenied) throw new Error("Recipient payout idempotency or authorization check failed");

publicState.recipientPayoutCheckpoint = { ...results, network: "TESTNET", generatedAt: new Date().toISOString(), signingMode: "automated local fixture key; not Freighter extension" };
await writeFile(publicStateUrl, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ network: "TESTNET", results, browserExtensionSigned: false, automatedFixtureSigning: true, secretsPrinted: false }, null, 2));
