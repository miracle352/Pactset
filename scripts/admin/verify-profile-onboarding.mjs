import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");

const make = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(name) {
  const client = make();
  const account = state.accounts[name];
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`${name} sign-in failed`);
  return client;
}

const crew = await login("crew2");
const supplier = await login("supplier");
const unrelated = await login("unrelated");
const publicUsername = "crew_b_preview";

const invalid = await crew.rpc("username_available", { p_username: "no spaces allowed" });
assert.equal(invalid.error, null);
assert.equal(invalid.data, false, "invalid usernames must not report available");

const save = await crew.from("profiles").update({ username: `  ${publicUsername.toUpperCase()}  `, country_code: "US", region_code: "CA", city: "Los Angeles", timezone: "America/Los_Angeles", preferred_test_currency: "TUSD" }).eq("id", state.accounts.crew2.userId).select("username,country_code,region_code,city,timezone,preferred_test_currency").single();
assert.equal(save.error, null, save.error?.message);
assert.equal(save.data.username, publicUsername, "database trigger must normalize usernames");

const duplicate = await supplier.from("profiles").update({ username: publicUsername.toUpperCase() }).eq("id", state.accounts.supplier.userId).select("username");
assert.equal(duplicate.error?.code, "23505", "case-insensitive uniqueness must reject duplicates");

const forbidden = await unrelated.from("profiles").update({ city: "Should not save" }).eq("id", state.accounts.crew2.userId).select("id");
assert.equal(forbidden.error, null);
assert.equal(forbidden.data.length, 0, "RLS must hide another account's update target");

await crew.auth.signOut();
const usernameLogin = make();
const resolved = await usernameLogin.functions.invoke("account-auth", { body: { action: "username-sign-in", username: publicUsername.toUpperCase(), password: state.accounts.crew2.password } });
if (resolved.error) {
  const detail = await resolved.error.context?.json().catch(() => null);
  throw new Error(`username sign-in edge function failed: ${JSON.stringify(detail ?? { status: resolved.error.context?.status })}`);
}
assert.equal(typeof resolved.data?.access_token, "string");
const session = await usernameLogin.auth.setSession({ access_token: resolved.data.access_token, refresh_token: resolved.data.refresh_token });
assert.equal(session.error, null);
const persisted = await usernameLogin.from("profiles").select("username,country_code,region_code,city,timezone,preferred_test_currency").eq("id", state.accounts.crew2.userId).single();
assert.equal(persisted.error, null);
assert.deepEqual(persisted.data, save.data, "settings must persist after a new sign-in session");
const roles = await usernameLogin.from("account_roles").select("role").eq("user_id", state.accounts.crew2.userId).eq("status", "active");
assert.equal(roles.error, null);
assert.ok(roles.data.some((item) => item.role === "crew"), "the existing crew role must remain active");

console.log(JSON.stringify({
  checks: {
    invalidRejected: true,
    normalizedAndSaved: true,
    duplicateRejectedCaseInsensitively: true,
    unrelatedUpdateDenied: true,
    persistedAcrossSignIn: true,
    rolePreserved: true,
  },
  account: "Crew B development identity",
}, null, 2));
