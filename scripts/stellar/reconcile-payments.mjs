import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

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

const results = [];
for (const [role, account] of Object.entries(fixtures.accounts)) {
  if (!account.email || !account.password) continue;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
  if (signInError) throw new Error(`Could not sign in the ${role} reconciliation identity`);
  const { data, error } = await supabase.functions.invoke("stellar-payments", { body: { action: "reconcile" } });
  await supabase.auth.signOut();
  if (error) throw new Error(`Reconciliation failed for ${role}`);
  results.push({ role, checked: data?.reconciled?.length ?? 0, statuses: (data?.reconciled ?? []).map((item) => item.status) });
}

console.log(JSON.stringify({ network: "TESTNET", results, secretsPrinted: false }, null, 2));
