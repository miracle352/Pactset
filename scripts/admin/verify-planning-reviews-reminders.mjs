import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");
const make = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(name) { const client = make(); const account = state.accounts[name]; const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password }); if (error) throw new Error(`${name} sign-in failed: ${error.message}`); return client; }
function must(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
const checks = [];
const check = (name, ok, details = {}) => checks.push({ name, ok, details });
const organizer = await login("organizer");
const supplier = await login("supplier");
const crew = await login("crew");
const unrelated = await login("unrelated");
const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

const event = must(await organizer.from("events").insert({ organizer_id: state.accounts.organizer.userId, name: `Budget verification ${suffix}`, event_type: "Development verification", city: "London", timezone: "Europe/London", starts_at: "2031-10-30T12:00:00.000Z", ends_at: "2031-10-30T18:00:00.000Z", preparation_deadline: "2031-10-29T12:00:00.000Z", attendee_count: 100, venue_capacity: 150, budget_currency: "TEUR", contingency_amount: 0, spaces: ["Main hall"], food_requirements: ["Lunch"], equipment_requirements: { rental: ["PA"] }, crew_requirements: ["Stage crew"], budget_allocations: [] }).select("id").single(), "create isolated budget event");
const budget = must(await organizer.rpc("save_event_budget", { p_event_id: event.id, p_total_amount: 10000, p_contingency_amount: 1000, p_allocations: [{ category: "Venue", amount: 4000 }, { category: "Food", amount: 2500 }, { category: "Equipment", amount: 1000 }, { category: "Crew", amount: 1500 }], p_assumptions: ["Development verification; not a market quote."], p_input_snapshot: { attendees: 100 }, p_proposal_source: "rule_based" }), "save budget version");
const approved = must(await organizer.rpc("approve_event_budget", { p_budget_id: budget.id }), "approve budget version");
check("budget:versioned-approved", approved.version === 1 && approved.status === "approved" && approved.currency === "TEUR", { version: approved.version, currency: approved.currency });
check("budget:unrelated-cannot-read", must(await unrelated.from("event_budget_versions").select("id").eq("id", budget.id), "unrelated budget read").length === 0);
check("budget:non-owner-cannot-approve", Boolean((await supplier.rpc("approve_event_budget", { p_budget_id: budget.id })).error));
const eventAfter = must(await organizer.from("events").select("status,contingency_amount,budget_allocations").eq("id", event.id).single(), "approved event plan");
check("budget:approval-updates-planning-only", eventAfter.status === "planning" && Number(eventAfter.contingency_amount) === 1000 && eventAfter.budget_allocations.length === 4);

const completedEscrows = must(await organizer.from("agreement_escrows").select("agreement_id").eq("status", "completed").limit(20), "load completed escrows");
let reviewEvidence = { available: false };
for (const item of completedEscrows) {
  const agreementResult = await organizer.from("agreements").select("id,organizer_id,provider_id,provider_role").eq("id", item.agreement_id).maybeSingle();
  if (agreementResult.error || !agreementResult.data || agreementResult.data.organizer_id !== state.accounts.organizer.userId) continue;
  const agreement = agreementResult.data;
  const prior = must(await organizer.from("agreement_reviews").select("*").eq("agreement_id", agreement.id).eq("reviewer_id", state.accounts.organizer.userId).maybeSingle(), "existing review");
  const review = prior ?? must(await organizer.rpc("submit_agreement_review", { p_agreement_id: agreement.id, p_rating: 5, p_body: "Development verification review tied to confirmed completed work.", p_visibility: "participants" }), "submit completed review");
  const provider = agreement.provider_id === state.accounts.supplier.userId ? supplier : agreement.provider_id === state.accounts.crew.userId ? crew : null;
  if (!provider) continue;
  if (!review.response_body) must(await provider.rpc("respond_agreement_review", { p_review_id: review.id, p_response: "Development verification response from the reviewed participant." }), "review response");
  check("reviews:completed-participant-review", review.rating === 5 && review.subject_id === agreement.provider_id, { agreementId: agreement.id });
  check("reviews:unrelated-cannot-read", must(await unrelated.from("agreement_reviews").select("id").eq("id", review.id), "unrelated review read").length === 0);
  check("reviews:unrelated-cannot-submit", Boolean((await unrelated.rpc("submit_agreement_review", { p_agreement_id: agreement.id, p_rating: 5, p_body: "Unauthorized unrelated review attempt.", p_visibility: "participants" })).error));
  reviewEvidence = { available: true, agreementId: agreement.id, reviewId: review.id };
  break;
}
check("reviews:eligible-fixture-available", reviewEvidence.available, reviewEvidence);
check("reminders:ordinary-user-cannot-run-worker", Boolean((await organizer.rpc("refresh_scheduled_reminders")).error));

must(await organizer.from("events").delete().eq("id", event.id), "clean isolated budget event");
check("budget:isolated-fixture-cleaned", must(await organizer.from("events").select("id").eq("id", event.id), "confirm cleanup").length === 0);
for (const client of [organizer, supplier, crew, unrelated]) await client.auth.signOut();
const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ passed: checks.length - failed.length, total: checks.length, failed, checks, secretsPrinted: false }, null, 2));
if (failed.length) process.exitCode = 1;
