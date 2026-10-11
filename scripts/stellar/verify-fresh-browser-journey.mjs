import { Asset, Horizon, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";

const fixtures = {
  TUSD: { agreementId: "342466d3-c812-4dcb-ad12-9d9f373a70d4", milestoneId: "2f0c38d4-61c4-4607-b065-a71184c34fd9", amount: "30.0000000" },
  TEUR: { agreementId: "69cd95a1-9651-4484-bd26-b4e2ff61ace4", milestoneId: "6fd9e1cf-75f8-45b4-90ba-6bca7e8cdf2e", amount: "20.0000000" },
};

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

const environment = parseEnvironment(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const authFixtures = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const stellarState = JSON.parse(await readFile(new URL("../../.stellar-testnet.local.json", import.meta.url), "utf8"));
const publicStateUrl = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const publicState = JSON.parse(await readFile(publicStateUrl, "utf8"));
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
if (!url || !key || stellarState.network !== "TESTNET") throw new Error("Missing Testnet development configuration");

async function signIn(role) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = authFixtures.accounts[role];
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw new Error(`Could not sign in ${role}`);
  return { token: data.session.access_token, client };
}

async function call(token, body, expected = 200) {
  const response = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (response.status !== expected) throw new Error(`${body.action}/${body.transactionAction ?? ""} returned ${response.status}: ${data.error ?? data.code ?? "unknown"} (${data.code ?? "no_code"})`);
  return data;
}

async function confirmedTransactions(client, agreementId) {
  const { data, error } = await client.from("payment_transactions").select("kind,tx_hash,ledger").eq("agreement_id", agreementId).eq("status", "confirmed");
  if (error) throw new Error(`Could not read reconciled transaction state: ${error.message}`);
  return data;
}

async function prepareSignSubmit(token, keypair, agreementId, transactionAction, extra = {}) {
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

async function balance(publicKey, code) {
  const issuer = stellarState.assets[code].issuer;
  const account = await horizon.loadAccount(publicKey);
  return account.balances.find((item) => item.asset_code === code && item.asset_issuer === issuer)?.balance ?? "0.0000000";
}

const organizerSession = await signIn("organizer");
const supplierSession = await signIn("supplier");
const organizerToken = organizerSession.token;
const supplierToken = supplierSession.token;
const organizer = Keypair.fromSecret(stellarState.accounts.organizer.secret);
const supplier = Keypair.fromSecret(stellarState.accounts.supplier.secret);
const results = {};

for (const code of ["TUSD", "TEUR"]) {
  const fixture = fixtures[code];
  const existing = await confirmedTransactions(organizerSession.client, fixture.agreementId);
  const existingConversion = existing.find((item) => item.kind === "conversion");
  if (existingConversion) {
    results[code] = { conversion: { hash: existingConversion.tx_hash, ledger: existingConversion.ledger }, resumedFromConfirmedLedger: true };
    continue;
  }
  let quoteResponse = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${organizerToken}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ action: "quote", agreementId: fixture.agreementId }) });
  let quoteBody = await quoteResponse.json();
  let trustline = null;
  if (quoteResponse.status === 409 && quoteBody.requiresTrustline) {
    trustline = await prepareSignSubmit(organizerToken, organizer, fixture.agreementId, "change_trust");
    quoteBody = await call(organizerToken, { action: "quote", agreementId: fixture.agreementId });
  } else if (!quoteResponse.ok) throw new Error(`${code} quote failed: ${quoteBody.code ?? quoteBody.error}`);
  const conversion = await prepareSignSubmit(organizerToken, organizer, fixture.agreementId, "convert", { quoteId: quoteBody.quote.id });
  results[code] = { trustline, quote: { expectedInput: quoteBody.quote.expectedInput, maximumInput: quoteBody.quote.maximumInput, exactOutput: quoteBody.quote.exactOutput, expiresAt: quoteBody.quote.expiresAt }, conversion };
}

const supplierBefore = await balance(supplier.publicKey(), "TUSD");
const existingTUSD = await confirmedTransactions(organizerSession.client, fixtures.TUSD.agreementId);
results.TUSD.funding = existingTUSD.find((item) => item.kind === "funding") ?? await prepareSignSubmit(organizerToken, organizer, fixtures.TUSD.agreementId, "fund");
if (!existingTUSD.some((item) => item.kind === "submission")) {
  await call(supplierToken, { action: "recordEvidence", agreementId: fixtures.TUSD.agreementId, milestoneId: fixtures.TUSD.milestoneId, note: "Automated Stage 2B browser-API fixture: lighting handoff evidence ready for organizer review.", objectPath: null, mediaType: null, sizeBytes: null });
  results.TUSD.submission = await prepareSignSubmit(supplierToken, supplier, fixtures.TUSD.agreementId, "submit", { milestoneIndex: 0 });
} else results.TUSD.submission = existingTUSD.find((item) => item.kind === "submission");
results.TUSD.release = existingTUSD.find((item) => item.kind === "release") ?? await prepareSignSubmit(organizerToken, organizer, fixtures.TUSD.agreementId, "approve_release", { milestoneIndex: 0 });
const supplierAfter = await balance(supplier.publicKey(), "TUSD");
results.TUSD.recipientBalance = { before: supplierBefore, after: supplierAfter, expectedIncrease: fixtures.TUSD.amount };

publicState.browserPaymentCheckpoint = { network: "TESTNET", generatedAt: new Date().toISOString(), agreements: fixtures, results, signingMode: "automated local fixture keys; not a browser extension" };
await writeFile(publicStateUrl, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ network: "TESTNET", results, browserExtensionSigned: false, automatedFixtureSigning: true, secretsPrinted: false }, null, 2));
