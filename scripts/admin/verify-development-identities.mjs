import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")];
  }));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing development Supabase public configuration");

const expectedRoles = {
  organizer: ["organizer"],
  supplier: ["supplier"],
  crew: ["crew"],
  crew2: ["crew"],
  support: ["support"],
  unrelated: [],
};
const clients = {};
const checks = [];

function record(name, passed, detail) {
  checks.push({ name, passed, detail });
  if (!passed) process.exitCode = 1;
}

for (const name of Object.keys(expectedRoles)) {
  const account = state.accounts[name];
  if (!account?.email || !account?.password || !account?.userId) throw new Error(`Missing ignored fixture for ${name}`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  record(`${name}:login`, !error && data.user?.id === account.userId, error?.message ?? "separate Auth identity restored");
  clients[name] = client;
  const roles = await client.from("account_roles").select("role,status").order("role");
  const actual = (roles.data ?? []).filter((item) => item.status === "active").map((item) => item.role);
  record(`${name}:roles`, !roles.error && JSON.stringify(actual) === JSON.stringify(expectedRoles[name]), roles.error?.message ?? (actual.join(",") || "none"));
}

const ids = Object.values(state.accounts).filter((item) => item?.userId).map((item) => item.userId);
record("identities:distinct", new Set(ids).size === ids.length, `${new Set(ids).size} distinct fixture identities`);

const escalation = await clients.crew2.from("account_roles").insert({ user_id: state.accounts.crew2.userId, role: "support" });
record("authorization:support-self-assignment-rejected", Boolean(escalation.error), escalation.error ? "database policy rejected ordinary caller" : "unexpectedly allowed");

const privateAgreementId = "342466d3-c812-4dcb-ad12-9d9f373a70d4";
for (const name of ["support", "unrelated", "crew2"]) {
  const agreement = await clients[name].from("agreements").select("id").eq("id", privateAgreementId);
  record(`${name}:private-agreement-denied`, !agreement.error && (agreement.data?.length ?? 0) === 0, agreement.error?.message ?? `${agreement.data?.length ?? 0} visible`);
  const evidence = await clients[name].from("milestone_evidence").select("id");
  record(`${name}:private-evidence-denied`, !evidence.error && (evidence.data?.length ?? 0) === 0, evidence.error?.message ?? `${evidence.data?.length ?? 0} visible`);
}

const supportDisputes = await clients.support.from("escrow_milestones").select("id").eq("status", "disputed");
record("support:unassigned-disputes-hidden", !supportDisputes.error && (supportDisputes.data?.length ?? 0) === 0, supportDisputes.error?.message ?? `${supportDisputes.data?.length ?? 0} visible`);

const organizerAgreement = await clients.organizer.from("agreements").select("id").eq("id", privateAgreementId).maybeSingle();
record("organizer:participant-agreement-visible", !organizerAgreement.error && organizerAgreement.data?.id === privateAgreementId, organizerAgreement.error?.message ?? "visible");
const supplierAgreement = await clients.supplier.from("agreements").select("id").eq("id", privateAgreementId).maybeSingle();
record("supplier:participant-agreement-visible", !supplierAgreement.error && supplierAgreement.data?.id === privateAgreementId, supplierAgreement.error?.message ?? "visible");
const crewAgreement = await clients.crew.from("agreements").select("id").eq("provider_id", state.accounts.crew.userId).limit(1);
record("crew-a:own-agreement-visible", !crewAgreement.error && (crewAgreement.data?.length ?? 0) > 0, crewAgreement.error?.message ?? `${crewAgreement.data?.length ?? 0} visible`);

for (const client of Object.values(clients)) await client.auth.signOut();

console.log(JSON.stringify({
  project: "pactset-development",
  checks,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  assignedCaseWorkflowImplemented: false,
  secretsPrinted: false,
}, null, 2));
