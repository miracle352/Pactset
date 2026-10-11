"use client";

import { ChatCircleDots, CheckCircle, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { markConversationRead, requestDeadlineExtension, requestMessageTranslation, respondDeadlineExtension, sendAgreementMessage } from "@/app/workspace/agreements/actions";
import { ConversationLiveRefresh } from "@/components/agreements/conversation-live-refresh";
import { SplitFlapCountdown } from "@/components/time/split-flap-countdown";
import { initialFormState } from "@/lib/form-state";

export type MessageTranslation = { target_language: string; translated_body: string | null; status: "pending" | "available" | "failed" | "unavailable"; provider: string | null; error_code: string | null; completed_at: string | null };
export type AgreementMessage = { id: string; author_id: string; body_original: string; language_code: string; support_reminder: boolean; created_at: string; agreement_message_translations?: MessageTranslation[] };
export type DeadlineRequest = { id: string; requested_by: string; original_deadline: string | null; proposed_deadline: string; reason: string; status: string; response_reason: string | null; responded_by?: string | null; responded_at?: string | null; created_at: string };

function FormMessage({ state }: { state: typeof initialFormState }) {
  return state.message ? <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}</p> : null;
}

export function AgreementConversation({ agreementId, currentUserId, messages, unreadCount = 0, hasOlder = false, nextLimit = 100 }: { agreementId: string; currentUserId: string; messages: AgreementMessage[]; unreadCount?: number; hasOlder?: boolean; nextLimit?: number }) {
  const [state, action, pending] = useActionState(sendAgreementMessage.bind(null, agreementId), initialFormState);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { setIdempotencyKey(crypto.randomUUID()); }, []);
  useEffect(() => { if (state.status === "success") { formRef.current?.reset(); setIdempotencyKey(crypto.randomUUID()); } }, [state.status]);
  const latestMessage = messages.at(-1);
  return <section id="messages" className="agreement-collaboration financial-surface"><ConversationLiveRefresh agreementId={agreementId} /><div className="compact-section-heading"><div><p className="kicker">Private booking conversation</p><h2>Keep the work and context together</h2><p>Only agreement participants and support assigned to an active case can read or send here.</p></div><ChatCircleDots /></div>
    {hasOlder && <Link className="button button-secondary" href={`/workspace/agreements/${agreementId}/payment?messages=${nextLimit}#messages`}>Load older messages</Link>}{messages.length ? <ol className="agreement-message-list">{messages.map((message) => <li key={message.id}><div><strong>{message.author_id === currentUserId ? "You" : "Agreement participant"}</strong><span>{new Date(message.created_at).toLocaleString()}</span></div><p lang={message.language_code === "und" ? undefined : message.language_code}>{message.body_original}</p><small>Original message · {message.language_code === "und" ? "language not specified" : message.language_code.toUpperCase()}</small><MessageTranslationControl agreementId={agreementId} message={message} />{message.support_reminder && <aside className="support-reminder"><WarningCircle /><span>Support is available if this conversation needs a neutral review. A reminder is not a finding of fault.</span></aside>}</li>)}</ol> : <p className="empty-inline">No messages yet. Start with a schedule, scope, evidence, or booking question.</p>}
    {latestMessage && unreadCount > 0 && <MarkReadControl agreementId={agreementId} messageId={latestMessage.id} unreadCount={unreadCount} />}
    <form ref={formRef} action={action} className="agreement-message-form"><input type="hidden" name="idempotencyKey" value={idempotencyKey} /><label>Original language<select name="languageCode" defaultValue={state.fields?.languageCode ?? "und"}><option value="und">Detect later / unknown</option><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option><option value="pt">Portuguese</option><option value="ar">Arabic</option></select></label><label className="wide">Message<textarea name="body" defaultValue={state.fields?.body} maxLength={4000} required placeholder="Write about this booking, evidence, or schedule…" /></label><p className="field-help">Type <strong>@support</strong> to open or link a private support case. You will see whether it is waiting for assignment or assigned.</p><FormMessage state={state} /><button className="button button-primary" type="submit" disabled={pending || !idempotencyKey} aria-busy={pending}>{pending ? "Sending…" : "Send message"}</button></form>
  </section>;
}

function MessageTranslationControl({ agreementId, message }: { agreementId: string; message: AgreementMessage }) {
  const [state, action, pending] = useActionState(requestMessageTranslation.bind(null, agreementId, message.id), initialFormState);
  const translation = message.agreement_message_translations?.[0];
  return <div className="message-translation"><form action={action}><label><span className="sr-only">Translate message to</span><select name="targetLanguage" defaultValue={translation?.target_language ?? "en"}><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option><option value="pt">Portuguese</option><option value="ar">Arabic</option></select></label><button className="button button-quiet" type="submit" disabled={pending}>{pending ? "Translating…" : translation?.status === "available" ? "Refresh translation" : "Translate"}</button></form>{translation?.status === "available" && translation.translated_body ? <details open><summary>Machine translation · show or hide</summary><p lang={translation.target_language}>{translation.translated_body}</p><small>Machine translated. Confirm names, amounts, dates, and terms against the original above.</small></details> : translation ? <small role={translation.status === "failed" ? "alert" : "status"}>Translation {translation.status}. The original remains available.{translation.error_code === "provider_not_configured" ? " Translation service configuration is still required." : ""}</small> : null}<FormMessage state={state} /></div>;
}

function MarkReadControl({ agreementId, messageId, unreadCount }: { agreementId: string; messageId: string; unreadCount: number }) {
  const [state, action, pending] = useActionState(markConversationRead.bind(null, agreementId, messageId), initialFormState);
  return <form action={action} className="conversation-read-control"><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Saving…" : `Mark ${unreadCount} new message${unreadCount === 1 ? "" : "s"} read`}</button><FormMessage state={state} /></form>;
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
