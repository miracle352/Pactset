import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const localEnvironment = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnvironment.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? localEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase development configuration is missing.");
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const create = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(name) {
  const account = state.accounts[name];
  if (!account) throw new Error(`Missing ${name} development identity.`);
  const client = create();
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`Could not sign in ${name}: ${error.message}`);
  return client;
}
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
const check = (name, ok, details = {}) => ({ name, ok, details });
const results = [];

const organizer = await signedIn("organizer");
const crew = await signedIn("crew2");
const support = await signedIn("support");
const unrelated = await signedIn("unrelated");

const replacements = must(await organizer.from("replacement_requests").select("id,original_agreement_id,replacement_request_id,replacement_agreement_id,invited_provider_id,status,budget_limit,currency").order("created_at", { ascending: false }).limit(10), "load organizer replacements");
const replacement = replacements.find((item) => item.invited_provider_id) ?? replacements[0];
if (replacement) {
  const unrelatedReplacement = must(await unrelated.from("replacement_requests").select("id").eq("id", replacement.id), "unrelated replacement read");
  const unrelatedAudit = must(await unrelated.from("replacement_events").select("id").eq("replacement_id", replacement.id), "unrelated replacement audit read");
  const unrelatedInvitation = replacement.replacement_request_id
    ? must(await unrelated.from("requests").select("id").eq("id", replacement.replacement_request_id), "unrelated invitation read")
    : [];
  results.push(check("replacement:unrelated-private-data-hidden", unrelatedReplacement.length === 0 && unrelatedAudit.length === 0 && unrelatedInvitation.length === 0, { replacementRows: unrelatedReplacement.length, auditRows: unrelatedAudit.length, invitationRows: unrelatedInvitation.length }));

  const providerReplacement = replacement.invited_provider_id === state.accounts.crew2.userId
    ? must(await crew.from("replacement_requests").select("id,status,budget_limit,currency").eq("id", replacement.id), "invited provider replacement read")
    : [];
  results.push(check("replacement:invited-provider-scope", replacement.invited_provider_id !== state.accounts.crew2.userId || providerReplacement.length === 1, { visible: providerReplacement.length }));

  const cases = must(await organizer.from("support_cases").select("id,status,assigned_support_id").eq("agreement_id", replacement.original_agreement_id).order("created_at", { ascending: false }).limit(1), "load replacement support case");
  const supportReplacement = must(await support.from("replacement_requests").select("id").eq("id", replacement.id), "support replacement read");
  const assignedActive = cases.some((item) => item.assigned_support_id === state.accounts.support.userId && ["assigned", "open", "under_review"].includes(item.status));
  results.push(check("support:replacement-access-follows-active-assignment", assignedActive ? supportReplacement.length === 1 : supportReplacement.length === 0, { assignedActive, visible: supportReplacement.length }));
}

const selfAssign = await support.from("support_cases").update({ assigned_support_id: state.accounts.support.userId }).neq("assigned_support_id", state.accounts.support.userId).select("id");
results.push(check("support:self-assignment-denied", Boolean(selfAssign.error) || (selfAssign.data?.length ?? 0) === 0, { rowsChanged: selfAssign.data?.length ?? 0 }));
const assignedCases = must(await support.from("support_cases").select("id,agreement_id,status").eq("assigned_support_id", state.accounts.support.userId).in("status", ["assigned", "under_review"]), "load assigned support cases");
const assignedAgreement = assignedCases[0]
  ? must(await support.from("agreements").select("id,organizer_id,provider_id,amount,currency").eq("id", assignedCases[0].agreement_id).single(), "load assigned-case agreement")
  : null;
results.push(check("support:assigned-case-fixture-available", assignedCases.length > 0, { assignedCases: assignedCases.length, organizerOwnsAssignedCase: assignedAgreement?.organizer_id === state.accounts.organizer.userId }));
if (assignedAgreement?.organizer_id === state.accounts.organizer.userId) {
  let assignedReplacement = must(await organizer.from("replacement_requests").select("id,status").eq("original_agreement_id", assignedAgreement.id).in("status", ["searching", "invited", "negotiating"]).limit(1).maybeSingle(), "load assigned-case replacement");
  if (!assignedReplacement) {
    assignedReplacement = must(await organizer.rpc("create_replacement_request", {
      p_original_agreement_id: assignedAgreement.id,
      p_reason: "Assigned-support replacement scope verification.",
      p_affected_tasks: ["Verify replacement privacy and case-scoped support access"],
      p_budget_limit: Number(assignedAgreement.amount),
      p_setup_minutes: 0,
      p_teardown_minutes: 0,
    }), "create assigned-case replacement");
  }
  const supportVisible = must(await support.from("replacement_requests").select("id,status").eq("id", assignedReplacement.id), "assigned support replacement read");
  const unrelatedVisible = must(await unrelated.from("replacement_requests").select("id").eq("id", assignedReplacement.id), "unrelated assigned-case replacement read");
  results.push(check("support:assigned-case-replacement-scoped", supportVisible.length === 1 && unrelatedVisible.length === 0, { assignedSupportRows: supportVisible.length, unrelatedRows: unrelatedVisible.length }));
  const browserStateUrl = new URL("../../.staging-preview-state.local.json", import.meta.url);
  let browserState = {};
  try { browserState = JSON.parse(await readFile(browserStateUrl, "utf8")); } catch {}
  browserState.assignedSupportReplacementId = assignedReplacement.id;
  await writeFile(browserStateUrl, JSON.stringify(browserState, null, 2), { mode: 0o600 });
}

const latestAgreement = must(await organizer.from("agreements").select("id,organizer_id,provider_id,preparation_deadline,starts_at,requests(events(timezone))").eq("provider_id", state.accounts.crew2.userId).order("created_at", { ascending: false }).limit(1).single(), "load isolated crew agreement");
const acceptedDeadline = "2032-07-20T10:00:00.000Z";
const requested = must(await organizer.rpc("request_deadline_extension", { p_agreement_id: latestAgreement.id, p_proposed_deadline: acceptedDeadline, p_reason: "Isolated two-party deadline persistence verification." }), "request accepted deadline");
must(await crew.rpc("respond_deadline_extension", { p_request_id: requested.id, p_accept: true, p_reason: "Crew acknowledges the revised preparation time." }), "accept deadline extension");

const organizerFresh = await signedIn("organizer");
const crewFresh = await signedIn("crew2");
const organizerView = must(await organizerFresh.from("deadline_extension_requests").select("status,proposed_deadline,response_reason,responded_by").eq("id", requested.id).single(), "organizer refreshed deadline");
const crewView = must(await crewFresh.from("deadline_extension_requests").select("status,proposed_deadline,response_reason,responded_by").eq("id", requested.id).single(), "crew refreshed deadline");
const sameInstant = (left, right) => new Date(left).getTime() === new Date(right).getTime();
results.push(check("deadline:accepted-visible-after-new-sessions", organizerView.status === "accepted" && crewView.status === "accepted" && sameInstant(organizerView.proposed_deadline, acceptedDeadline) && sameInstant(crewView.proposed_deadline, acceptedDeadline), { organizerStatus: organizerView.status, providerStatus: crewView.status }));

const rejectedDeadline = "2032-07-20T11:00:00.000Z";
const rejectedRequest = must(await crewFresh.rpc("request_deadline_extension", { p_agreement_id: latestAgreement.id, p_proposed_deadline: rejectedDeadline, p_reason: "Verify that a declined proposal cannot replace accepted terms." }), "request rejected deadline");
must(await organizerFresh.rpc("respond_deadline_extension", { p_request_id: rejectedRequest.id, p_accept: false, p_reason: "The later time conflicts with the event handoff." }), "reject deadline extension");
const history = must(await organizerFresh.from("deadline_extension_requests").select("id,status,proposed_deadline,created_at").eq("agreement_id", latestAgreement.id).order("created_at", { ascending: false }), "load deadline history");
const newestAccepted = history.find((item) => item.status === "accepted");
results.push(check("deadline:rejected-does-not-replace-accepted", history[0]?.status === "rejected" && sameInstant(newestAccepted?.proposed_deadline, acceptedDeadline), { latestStatus: history[0]?.status, acceptedDeadline: newestAccepted?.proposed_deadline }));

const originalAgreement = must(await organizerFresh.from("agreements").select("preparation_deadline,status").eq("id", latestAgreement.id).single(), "load immutable agreement deadline");
results.push(check("deadline:original-terms-remain-immutable", originalAgreement.preparation_deadline === latestAgreement.preparation_deadline && originalAgreement.status === "awaiting_testnet_funding", { status: originalAgreement.status }));

const failures = results.filter((item) => !item.ok);
console.log(JSON.stringify({ results, passed: results.length - failures.length, failed: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
