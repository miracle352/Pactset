"use client";

import { ChatCircleDots, CheckCircle, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { requestDeadlineExtension, respondDeadlineExtension, sendAgreementMessage } from "@/app/workspace/agreements/actions";
import { SplitFlapCountdown } from "@/components/time/split-flap-countdown";
import { initialFormState } from "@/lib/form-state";

export type AgreementMessage = { id: string; author_id: string; body_original: string; language_code: string; translated_body: string | null; translated_language_code: string | null; translation_status: string; support_reminder: boolean; created_at: string };
export type DeadlineRequest = { id: string; requested_by: string; original_deadline: string | null; proposed_deadline: string; reason: string; status: string; response_reason: string | null; responded_by?: string | null; responded_at?: string | null; created_at: string };

function FormMessage({ state }: { state: typeof initialFormState }) {
  return state.message ? <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}</p> : null;
}

export function AgreementConversation({ agreementId, currentUserId, messages }: { agreementId: string; currentUserId: string; messages: AgreementMessage[] }) {
  const [state, action, pending] = useActionState(sendAgreementMessage.bind(null, agreementId), initialFormState);
  return <section id="messages" className="agreement-collaboration financial-surface"><div className="compact-section-heading"><div><p className="kicker">Agreement conversation</p><h2>Keep the work and context together</h2></div><ChatCircleDots /></div>
    {messages.length ? <ol className="agreement-message-list">{messages.map((message) => <li key={message.id}><div><strong>{message.author_id === currentUserId ? "You" : "Agreement participant"}</strong><span>{new Date(message.created_at).toLocaleString()}</span></div><p lang={message.language_code === "und" ? undefined : message.language_code}>{message.body_original}</p>{message.translation_status === "available" && message.translated_body ? <details><summary>View translation</summary><p lang={message.translated_language_code ?? undefined}>{message.translated_body}</p></details> : <small>Original shown · translation {message.translation_status.replaceAll("_", " ")}</small>}{message.support_reminder && <aside className="support-reminder"><WarningCircle /><span>Keep the conversation constructive. If you need a neutral human review, use Contact support beside this agreement.</span></aside>}</li>)}</ol> : <p className="empty-inline">No agreement messages yet. Messages here are private to the participants and assigned support when a case is active.</p>}
    <form action={action} className="agreement-message-form"><label>Original language<select name="languageCode" defaultValue={state.fields?.languageCode ?? "und"}><option value="und">Detect later / unknown</option><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option><option value="pt">Portuguese</option><option value="ar">Arabic</option></select></label><label className="wide">Message<textarea name="body" defaultValue={state.fields?.body} maxLength={4000} required placeholder="Write about this booking, evidence, or schedule…" /></label><FormMessage state={state} /><button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Send message"}</button></form>
  </section>;
}

export function DeadlineExtensions({ agreementId, currentUserId, timezone, originalDeadline, requests, agreementStatus }: { agreementId: string; currentUserId: string; timezone: string; originalDeadline: string | null; requests: DeadlineRequest[]; agreementStatus?: string }) {
  const [state, action, pending] = useActionState(requestDeadlineExtension.bind(null, agreementId), initialFormState);
  const latest = requests[0];
  const accepted = requests.find((request) => request.status === "accepted");
  const effectiveDeadline = accepted?.proposed_deadline ?? originalDeadline;
  return <section className="agreement-collaboration financial-surface"><div className="compact-section-heading"><div><p className="kicker">Preparation deadline</p><h2>Changes require acknowledgement</h2></div><ClockCounterClockwise /></div><SplitFlapCountdown targetIso={effectiveDeadline} timezone={timezone} complete={agreementStatus === "completed"} cancelled={agreementStatus === "cancelled"} /><p>The accepted deadline remains: {effectiveDeadline ? new Date(effectiveDeadline).toLocaleString("en", { timeZone: timezone, timeZoneName: "short" }) : "not set"}. {accepted ? "Both participants acknowledged this extension." : "A pending request does not change it."}</p>
    {requests.length ? <ol className="deadline-history">{requests.map((request) => <li key={request.id}><div><strong>{request.status.replaceAll("_", " ")}</strong><span>{new Date(request.proposed_deadline).toLocaleString("en", { timeZone: timezone, timeZoneName: "short" })}</span></div><p><strong>{request.requested_by === currentUserId ? "You requested" : "The other participant requested"}:</strong> {request.reason}</p>{request.response_reason && <small>{request.responded_by === currentUserId ? "Your response" : "Participant response"}: {request.response_reason}{request.responded_at ? ` · ${new Date(request.responded_at).toLocaleString("en", { timeZone: timezone, timeZoneName: "short" })}` : ""}</small>}{request.status === "pending" && request.requested_by !== currentUserId && <DeadlineResponse agreementId={agreementId} requestId={request.id} />}</li>)}</ol> : null}
    {latest?.status !== "pending" && <form action={action} className="deadline-request-form"><input type="hidden" name="timezone" value={timezone} /><label>Proposed event-local deadline<input type="datetime-local" name="proposedDeadline" defaultValue={state.fields?.proposedDeadline} required /></label><label>Reason and work impact<textarea name="reason" defaultValue={state.fields?.reason} required minLength={10} maxLength={2000} /></label><FormMessage state={state} /><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Requesting…" : "Request deadline change"}</button></form>}
  </section>;
}

function DeadlineResponse({ agreementId, requestId }: { agreementId: string; requestId: string }) {
  const [acceptState, acceptAction, accepting] = useActionState(respondDeadlineExtension.bind(null, agreementId, requestId, true), initialFormState);
  const [rejectState, rejectAction, rejecting] = useActionState(respondDeadlineExtension.bind(null, agreementId, requestId, false), initialFormState);
  return <div className="deadline-response"><form action={acceptAction}><label>Acceptance reason<input name="reason" minLength={3} required /></label><FormMessage state={acceptState} /><button className="button button-success" type="submit" disabled={accepting || rejecting}>Accept change</button></form><form action={rejectAction}><label>Adjustment or decline reason<input name="reason" minLength={3} required /></label><FormMessage state={rejectState} /><button className="button button-secondary" type="submit" disabled={accepting || rejecting}>Propose adjustment</button></form></div>;
}
