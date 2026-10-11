import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const AGREEMENT_ID = "e6625251-d065-4879-add7-8ea679ec1e62";

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

const environment = parseEnvironment(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const fixtures = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing local Supabase development configuration");

async function session(role) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = fixtures.accounts[role];
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw new Error(`Could not sign in ${role}: ${error?.message ?? "session missing"}`);
  return data.session.access_token;
}

async function call(token, body) {
  const response = await fetch(`${url}/functions/v1/stellar-payments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

const organizer = await session("organizer");
const supplier = await session("supplier");
const unrelated = await session("unrelated");

const quote = await call(organizer, { action: "quote", agreementId: AGREEMENT_ID });
if (quote.status !== 200 || !quote.body.quote?.id) throw new Error(`Organizer quote failed with ${quote.status}`);
const prepared = await call(organizer, { action: "prepare", agreementId: AGREEMENT_ID, transactionAction: "convert", quoteId: quote.body.quote.id, idempotencyKey: `browser-api-${crypto.randomUUID()}` });
if (prepared.status !== 200 || !prepared.body.xdr || prepared.body.transaction?.status !== "prepared") throw new Error(`Unsigned conversion preparation failed with ${prepared.status}`);
const unauthorizedRelease = await call(supplier, { action: "prepare", agreementId: AGREEMENT_ID, transactionAction: "approve_release", milestoneIndex: 0, idempotencyKey: `unauthorized-${crypto.randomUUID()}` });
if (unauthorizedRelease.status !== 403 || unauthorizedRelease.body.code !== "unauthorized") throw new Error("Supplier release was not rejected at the server boundary");
const unrelatedRead = await call(unrelated, { action: "quote", agreementId: AGREEMENT_ID });
if (unrelatedRead.status !== 404) throw new Error("Unrelated account could reach a private payment agreement");
const mismatchedSubmission = await call(organizer, { action: "submit", agreementId: AGREEMENT_ID, transactionId: prepared.body.transaction.id, signedXdr: prepared.body.xdr });
if (mismatchedSubmission.status !== 400 || mismatchedSubmission.body.code !== "signature_mismatch") throw new Error("Unsigned envelope was not rejected");

console.log(JSON.stringify({
  network: "TESTNET",
  checks: {
    organizerQuote: "passed",
    unsignedEnvelopePrepared: "passed",
    supplierUnauthorizedRelease: "passed",
    unrelatedAgreementDenial: "passed",
    unsignedSubmissionRejected: "passed",
  },
  browserExtensionSigned: false,
  secretsPrinted: false,
}, null, 2));
