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
  if (error) throw new Error(`${name} sign-in failed (${error.status ?? "unknown"}): ${error.message}`);
  return client;
}
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
const checks = [];
const check = (name, ok, details = {}) => checks.push({ name, ok, details });
const organizer = await login("organizer");
const unrelated = await login("unrelated");

const agreement = must(await organizer.from("agreements").select("id").eq("organizer_id", state.accounts.organizer.userId).limit(1).single(), "authorized agreement");
const fixtures = [
  { source: "en", target: "fr", body: "Gemini verification fixture: Amina will deliver exactly 4 TGBP at 09:30 on 18 October. Details: https://pactset.test/brief.", preserved: ["Amina", "4 TGBP", "09:30", "18 October", "https://pactset.test/brief"] },
  { source: "fr", target: "en", body: "Test de vérification Gemini : Amina livrera exactement 4 TGBP à 09:30 le 18 octobre. Détails : https://pactset.test/brief.", preserved: ["Amina", "4 TGBP", "09:30", "18 octobre", "https://pactset.test/brief"] },
];
const translationResults = [];
for (const fixture of fixtures) {
  const message = must(await organizer.rpc("send_agreement_message", { p_agreement_id: agreement.id, p_body: fixture.body, p_language_code: fixture.source, p_idempotency_key: crypto.randomUUID() }), `send ${fixture.source} fixture`);
  const invoked = await organizer.functions.invoke("message-translation", { body: { messageId: message.id, targetLanguage: fixture.target } });
  check(`translation:${fixture.source}-${fixture.target}:provider-call`, !invoked.error && invoked.data?.status === "available", { status: invoked.data?.status ?? "failed" });
  const translated = must(await organizer.from("agreement_message_translations").select("status,translated_body,provider,error_code").eq("message_id", message.id).eq("target_language", fixture.target).single(), `read ${fixture.target} translation`);
  const preserved = fixture.preserved.every((token) => translated.translated_body?.includes(token));
  check(`translation:${fixture.source}-${fixture.target}:available`, translated.status === "available" && translated.provider?.startsWith("gemini:"), { status: translated.status, provider: translated.provider });
  check(`translation:${fixture.source}-${fixture.target}:tokens-preserved`, preserved);
  const original = must(await organizer.from("agreement_messages").select("body_original").eq("id", message.id).single(), "read original");
  check(`translation:${fixture.source}-${fixture.target}:original-preserved`, original.body_original === fixture.body);
  const denied = await unrelated.functions.invoke("message-translation", { body: { messageId: message.id, targetLanguage: fixture.target } });
  check(`translation:${fixture.source}-${fixture.target}:unrelated-denied`, Boolean(denied.error));
  translationResults.push({ direction: `${fixture.source}-${fixture.target}`, translatedText: translated.translated_body, provider: translated.provider });
}

const event = must(await organizer.from("events").insert({
  organizer_id: state.accounts.organizer.userId,
  name: `Gemini budget verification ${new Date().toISOString()}`,
  event_type: "Conference",
  city: "Lagos",
  timezone: "Africa/Lagos",
  starts_at: "2032-10-18T09:00:00.000Z",
  ends_at: "2032-10-18T17:00:00.000Z",
  preparation_deadline: "2032-10-17T17:00:00.000Z",
  attendee_count: 180,
  venue_capacity: 220,
  budget_currency: "TGBP",
  contingency_amount: 500,
  spaces: ["Main hall", "Registration"],
  food_requirements: ["Lunch", "Water"],
  equipment_requirements: { rental: ["PA", "Projector"] },
  crew_requirements: ["Registration crew", "Stage crew"],
  budget_allocations: [],
}).select("id").single(), "create isolated Gemini budget event");

try {
  const budgetCall = await organizer.functions.invoke("budget-suggestions", { body: { eventId: event.id, totalAmount: 10000, contingencyAmount: 500 } });
  check("budget:provider-call", !budgetCall.error && Array.isArray(budgetCall.data?.allocations), { status: budgetCall.error ? "failed" : "available" });
  const allocations = Array.isArray(budgetCall.data?.allocations) ? budgetCall.data.allocations : [];
  const allocated = allocations.reduce((sum, item) => sum + Number(item.amount), 0);
  check("budget:validated-structure", allocations.length > 0 && allocations.every((item) => typeof item.category === "string" && Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0));
  check("budget:exact-spendable-total", Math.abs(allocated - 9500) <= 0.01, { allocated, expected: 9500 });
  check("budget:currency-preserved", budgetCall.data?.currency === "TGBP", { currency: budgetCall.data?.currency });
  const saved = must(await organizer.rpc("save_event_budget", {
    p_event_id: event.id,
    p_total_amount: 10000,
    p_contingency_amount: 500,
    p_allocations: allocations,
    p_assumptions: budgetCall.data?.assumptions ?? [],
    p_input_snapshot: { fixture: true, attendees: 180 },
    p_proposal_source: "ai",
  }), "save editable Gemini budget draft");
  check("budget:editable-draft-saved", saved.status === "draft" && saved.proposal_source === "ai", { version: saved.version, status: saved.status });
  const deniedBudget = await unrelated.functions.invoke("budget-suggestions", { body: { eventId: event.id, totalAmount: 10000, contingencyAmount: 500 } });
  check("budget:unrelated-denied", Boolean(deniedBudget.error));
  console.log(JSON.stringify({ model: translationResults[0]?.provider ?? "unavailable", translations: translationResults, budget: { currency: budgetCall.data?.currency, totalAmount: 10000, contingencyAmount: 500, allocations, assumptions: budgetCall.data?.assumptions ?? [] }, checks, secretsPrinted: false }, null, 2));
} finally {
  must(await organizer.from("events").delete().eq("id", event.id), "clean isolated Gemini budget event");
  await organizer.auth.signOut();
  await unrelated.auth.signOut();
}

const failed = checks.filter((item) => !item.ok);
if (failed.length) process.exitCode = 1;
