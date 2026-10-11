import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const agreementId = process.argv[2];
if (!agreementId) throw new Error("Pass an agreement ID.");

const envText = await readFile(new URL("../../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")];
}));
const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase public development configuration is missing.");

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function inspect(role) {
  const account = identities.accounts[role];
  if (!account) throw new Error(`Missing ${role} test identity.`);
  const api = client();
  const { data: session, error: signInError } = await api.auth.signInWithPassword({ email: account.email, password: account.password });
  if (signInError || !session.user) throw new Error(`${role} sign-in failed (${signInError?.status ?? "no status"}: ${signInError?.code ?? "unknown"}).`);

  const [agreementResult, exactPageQuery, listResult, rolesResult, profileResult] = await Promise.all([
    api.from("agreements").select("id,organizer_id,provider_id,provider_role,status,scope,amount,currency").eq("id", agreementId).maybeSingle(),
    api.from("agreements").select("*,requests(events(name,timezone))").eq("id", agreementId).maybeSingle(),
    api.from("agreements").select("id").order("created_at", { ascending: false }).limit(100),
    api.from("account_roles").select("role,status").eq("user_id", session.user.id).eq("status", "active"),
    api.from("profiles").select("display_name,username").eq("id", session.user.id).maybeSingle(),
  ]);

  return {
    role,
    userId: session.user.id,
    displayName: profileResult.data?.display_name ?? null,
    username: profileResult.data?.username ?? null,
    memberships: (rolesResult.data ?? []).map((item) => item.role),
    canReadAgreement: Boolean(agreementResult.data),
    exactPaymentPageQueryWorks: Boolean(exactPageQuery.data) && !exactPageQuery.error,
    agreementAppearsInList: (listResult.data ?? []).some((item) => item.id === agreementId),
    lookupErrorCode: agreementResult.error?.code ?? exactPageQuery.error?.code ?? null,
    agreement: agreementResult.data ? {
      id: agreementResult.data.id,
      organizerMatches: agreementResult.data.organizer_id === session.user.id,
      providerMatches: agreementResult.data.provider_id === session.user.id,
      providerRole: agreementResult.data.provider_role,
      status: agreementResult.data.status,
      scope: agreementResult.data.scope,
      amount: agreementResult.data.amount,
      currency: agreementResult.data.currency,
    } : null,
  };
}

const results = [];
for (const role of ["organizer", "supplier", "unrelated"]) results.push(await inspect(role));

const organizer = results.find((item) => item.role === "organizer");
const supplier = results.find((item) => item.role === "supplier");
const unrelated = results.find((item) => item.role === "unrelated");
if (!organizer?.agreement?.organizerMatches || !organizer.exactPaymentPageQueryWorks || !organizer.agreementAppearsInList) {
  throw new Error("The intended organizer cannot open the agreement through the ordinary participant policy.");
}
if (!supplier?.agreement?.providerMatches || !supplier.exactPaymentPageQueryWorks) {
  throw new Error("The intended provider cannot open the agreement through the ordinary participant policy.");
}
if (unrelated?.canReadAgreement || unrelated?.exactPaymentPageQueryWorks || unrelated?.agreementAppearsInList) {
  throw new Error("An unrelated account can read the private agreement.");
}

console.log(JSON.stringify({
  projectRef: new URL(url).hostname.split(".")[0],
  agreementId,
  results,
  verdict: "Organizer and provider participant reads pass; unrelated-account denial passes.",
}, null, 2));
