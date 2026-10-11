import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const make = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(name) { const client = make(); const account = state.accounts[name]; const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password }); if (error) throw new Error(`${name} sign-in failed`); return client; }
function data(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
const results = [];
const check = (name, ok, details = {}) => results.push({ name, ok, details });

const organizer = await login("organizer");
const support = await login("support");
const unrelated = await login("unrelated");
const supplier = await login("supplier");
const crewA = await login("crew");
const crewB = await login("crew2");
const cases = data(await support.from("support_cases").select("id,agreement_id,assigned_support_id,status").eq("assigned_support_id", state.accounts.support.userId).in("status", ["assigned", "under_review"]).limit(1), "assigned case");
if (!cases[0]) throw new Error("No assigned support fixture is available.");
const agreementId = cases[0].agreement_id;
const agreement = data(await organizer.from("agreements").select("organizer_id,provider_id,provider_role").eq("id", agreementId).single(), "agreement");
const providerName = agreement.provider_id === state.accounts.supplier.userId ? "supplier" : agreement.provider_id === state.accounts.crew.userId ? "crew" : "crew2";
const provider = providerName === "supplier" ? supplier : providerName === "crew" ? crewA : crewB;

const idempotencyKey = crypto.randomUUID();
const body = `Messaging verification ${new Date().toISOString()} @support`;
const first = data(await organizer.rpc("send_agreement_message", { p_agreement_id: agreementId, p_body: body, p_language_code: "en", p_idempotency_key: idempotencyKey }), "first send");
const retry = data(await organizer.rpc("send_agreement_message", { p_agreement_id: agreementId, p_body: body, p_language_code: "en", p_idempotency_key: idempotencyKey }), "retry send");
check("message:idempotent-send", first.id === retry.id, { sameMessage: first.id === retry.id });
check("message:provider-can-read", data(await provider.from("agreement_messages").select("id").eq("id", first.id), "provider read").length === 1, { providerRole: providerName });
check("message:assigned-support-can-read", data(await support.from("agreement_messages").select("id").eq("id", first.id), "support read").length === 1);
check("message:unrelated-cannot-read", data(await unrelated.from("agreement_messages").select("id").eq("id", first.id), "unrelated read").length === 0);
const unauthorizedSend = await unrelated.rpc("send_agreement_message", { p_agreement_id: agreementId, p_body: "Unauthorized", p_language_code: "en", p_idempotency_key: crypto.randomUUID() });
check("message:unrelated-cannot-send", Boolean(unauthorizedSend.error));
const members = data(await organizer.from("agreement_conversation_members").select("user_id,membership_role,active").eq("agreement_id", agreementId), "members");
check("message:explicit-membership", members.some((item) => item.user_id === agreement.organizer_id && item.active) && members.some((item) => item.user_id === agreement.provider_id && item.active) && members.some((item) => item.user_id === state.accounts.support.userId && item.active), { activeMembers: members.filter((item) => item.active).length });

const translate = await organizer.functions.invoke("message-translation", { body: { messageId: first.id, targetLanguage: "fr" } });
const translation = data(await organizer.from("agreement_message_translations").select("status,error_code,target_language").eq("message_id", first.id).eq("target_language", "fr").single(), "translation state");
check("translation:honest-provider-state", translate.error != null && translation.status === "unavailable" && translation.error_code === "provider_not_configured", { status: translation.status, providerConfigured: false });
const original = data(await organizer.from("agreement_messages").select("body_original").eq("id", first.id).single(), "original message");
check("translation:original-authoritative", original.body_original === body);

data(await provider.rpc("mark_agreement_conversation_read", { p_agreement_id: agreementId, p_message_id: first.id }), "mark read");
const read = data(await provider.from("agreement_conversation_reads").select("last_read_message_id").eq("agreement_id", agreementId).single(), "read position");
check("message:explicit-read-position", read.last_read_message_id === first.id);
const notifications = data(await provider.from("account_notifications").select("kind,body,href,read_at").eq("entity_id", agreementId).in("kind", ["agreement_message", "support_requested"]).order("created_at", { ascending: false }), "notifications");
check("notifications:authorized-deduplicated-destinations", notifications.some((item) => item.kind === "agreement_message" && item.href?.includes(agreementId)) && notifications.filter((item) => item.kind === "agreement_message").length === 1, { rows: notifications.length });
check("notifications:no-private-message-preview", notifications.every((item) => !item.body.includes("Messaging verification")));
const activeCases = data(await organizer.from("support_cases").select("id").eq("agreement_id", agreementId).in("status", ["open", "assigned", "under_review"]), "linked cases");
check("support:mention-reuses-case", activeCases.length === 1, { activeCases: activeCases.length });

const failures = results.filter((item) => !item.ok);
console.log(JSON.stringify({ agreementFixture: "isolated development agreement", results, passed: results.length - failures.length, failed: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
