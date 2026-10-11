import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
  }));
}
function must(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }

const env = parseEnvironment(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes("lvpsemqalftvcqkrjsyu")) throw new Error("Refusing to test outside pactset-development.");
const makeClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function session(role) {
  const client = makeClient(); const account = identities.accounts[role];
  must(await client.auth.signInWithPassword({ email: account.email, password: account.password }), `sign in ${role}`);
  return { client, account };
}

const supplier = await session("supplier");
const crew = await session("crew");
const unrelated = await session("unrelated");
const anon = makeClient();

must(await supplier.client.from("provider_profiles").update({ portfolio_visibility: "public" }).eq("user_id", supplier.account.userId), "publish supplier portfolio");
must(await crew.client.from("provider_profiles").update({ portfolio_visibility: "private" }).eq("user_id", crew.account.userId), "keep crew portfolio private");

const publicPortfolio = must(await anon.rpc("get_public_provider_portfolio", { p_provider_id: supplier.account.userId }), "read public supplier portfolio");
const privatePortfolio = must(await anon.rpc("get_public_provider_portfolio", { p_provider_id: crew.account.userId }), "read private crew portfolio");
const publicDirect = must(await unrelated.client.from("provider_profiles").select("user_id,portfolio_visibility").eq("user_id", supplier.account.userId), "read public provider row");
const privateDirect = must(await unrelated.client.from("provider_profiles").select("user_id,portfolio_visibility").eq("user_id", crew.account.userId), "deny private provider row");
const personalDirect = must(await unrelated.client.from("profiles").select("id").eq("id", supplier.account.userId), "deny provider account settings");

if (!publicPortfolio || publicPortfolio.user_id !== supplier.account.userId) throw new Error("Published portfolio was not returned.");
if (privatePortfolio !== null) throw new Error("Private portfolio was exposed through the public function.");
if (publicDirect.length !== 1 || privateDirect.length !== 0 || personalDirect.length !== 0) throw new Error("Portfolio/profile policies did not enforce expected visibility.");
if ("preferred_test_currency" in publicPortfolio || "timezone" in publicPortfolio || "service_radius_km" in publicPortfolio) throw new Error("Private account preferences leaked into public portfolio.");

console.log(JSON.stringify({ publicPortfolioVisible: true, privatePortfolioDenied: true, privateDirectReadDenied: true, personalSettingsDenied: true, secretsPrinted: false }));
