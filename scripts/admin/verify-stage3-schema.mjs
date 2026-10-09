import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const parseEnv = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")]; }));
const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signInError } = await client.auth.signInWithPassword({ email: state.accounts.organizer.email, password: state.accounts.organizer.password });
if (signInError) throw new Error(`Development organizer sign-in failed: ${signInError.message}`);

const tables = ["agreement_messages", "deadline_extension_requests", "event_change_requests", "pactset_go_runtime_registry"];
const results = [];
for (const table of tables) {
  const { error } = await client.from(table).select("id").limit(1);
  results.push({ table, available: !error, code: error?.code ?? null });
}
const { data: runtime, error: runtimeError } = await client.from("pactset_go_runtime_registry").select("network,contract_version,wasm_hash,active,max_bookings").eq("network", "TESTNET").eq("active", true).maybeSingle();
const { count: bundleCount, error: bundleError } = await client.from("pactset_go_bundles").select("id", { head: true, count: "exact" });
const { data: sessionData } = await client.auth.getSession();
const functionResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pactset-go`, { method: "POST", headers: { Authorization: `Bearer ${sessionData.session.access_token}`, apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ action: "capabilities" }) });
const functionPayload = await functionResponse.json().catch(() => ({}));
await client.auth.signOut();
console.log(JSON.stringify({
  project: new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0],
  tables: results,
  runtime: runtimeError ? { available: false, code: runtimeError.code } : runtime,
  visibleBundleCount: bundleError ? null : bundleCount,
  edgeFunction: { deployed: functionResponse.ok, status: functionResponse.status, available: functionPayload.available ?? false },
}, null, 2));
if (!results.every((item) => item.available) || runtimeError || !functionResponse.ok || !functionPayload.available) process.exitCode = 1;
