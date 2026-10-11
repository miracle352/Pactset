"use client";

import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState } from "react";
import { cancelReplacement, createReplacement, inviteReplacement, reviseReplacementBudget } from "@/app/workspace/replacements/actions";
import { initialFormState } from "@/lib/form-state";

function Message({ state }: { state: typeof initialFormState & { entityId?: string } }) {
  if (!state.message) return null;
  return <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}{state.entityId && <Link href={`/workspace/replacements/${state.entityId}`}>Review candidates <ArrowRight /></Link>}</p>;
}

export function ReplacementRequestForm({ agreementId, amount, currency }: { agreementId: string; amount: number; currency: string }) {
  const [state, action, pending] = useActionState(createReplacement, initialFormState);
  return <details className="replacement-form glass-panel"><summary>Find a replacement</summary><form action={action}><input type="hidden" name="agreementId" value={agreementId} /><div className="form-grid"><label className="wide">Why is a replacement needed?<textarea name="reason" rows={3} required /></label><label className="wide">Affected tasks<textarea name="affectedTasks" rows={3} placeholder="Equipment delivery&#10;Setup and sound check" required /></label><label>Maximum new funding ({currency})<input name="budgetLimit" type="number" min="0" step="0.01" defaultValue={amount} required /></label><label>Setup buffer (minutes)<input name="setupMinutes" type="number" min="0" max="10080" defaultValue="0" required /></label><label>Teardown buffer (minutes)<input name="teardownMinutes" type="number" min="0" max="10080" defaultValue="0" required /></label></div><p className="field-note">This creates a separate search and agreement. Original, disputed, owed, and expected-refund money is never reused.</p><Message state={state} /><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Creating search" : "Find eligible providers"}</button></form></details>;
}

export function InviteReplacementForm({ replacementId, provider }: { replacementId: string; provider: { provider_id: string; display_name: string; headline: string; inventory_name?: string | null; available_quantity: number } }) {
  const [state, action, pending] = useActionState(inviteReplacement, initialFormState);
  return <form action={action} className="candidate-row"><input type="hidden" name="replacementId" value={replacementId} /><input type="hidden" name="providerId" value={provider.provider_id} /><div><strong>{provider.display_name}</strong><p>{provider.headline || "Eligible provider"}{provider.inventory_name ? ` · ${provider.inventory_name}: ${provider.available_quantity} available` : ""}</p></div><label><span className="sr-only">Invitation note</span><input name="reason" defaultValue="Please review this time-sensitive replacement request." required /></label><button type="submit" className="button button-secondary" disabled={pending}>{pending ? "Sending" : "Invite"}</button><Message state={state} /></form>;
}

export function ReplacementControls({ replacementId, currency, budgetLimit, status }: { replacementId: string; currency: string; budgetLimit: number; status: string }) {
  const [budgetState, budgetAction, budgetPending] = useActionState(reviseReplacementBudget, initialFormState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelReplacement, initialFormState);
  if (!['searching', 'invited', 'negotiating'].includes(status)) return null;
  return <section className="replacement-controls glass-panel"><div className="compact-section-heading"><div><p className="kicker">Organizer controls</p><h2>Adjust the search without changing the original booking</h2></div></div><div className="replacement-control-grid"><form action={budgetAction}><input type="hidden" name="replacementId" value={replacementId} /><label>Maximum new funding ({currency})<input name="budgetLimit" type="number" min="0" step="0.01" defaultValue={budgetLimit} required /></label><label>Reason<textarea name="reason" rows={2} required /></label><Message state={budgetState} /><button type="submit" className="button button-secondary" disabled={budgetPending}>{budgetPending ? 'Saving' : 'Revise budget'}</button></form><form action={cancelAction}><input type="hidden" name="replacementId" value={replacementId} /><label>Reason for closing<textarea name="reason" rows={2} required /></label><Message state={cancelState} /><button type="submit" className="button button-destructive" disabled={cancelPending}>{cancelPending ? 'Closing' : 'Close replacement search'}</button></form></div><p className="field-note">A revised ceiling is audited and cannot undercut a current offer. Closing this search releases offer reservations only; it never cancels or moves money from the original agreement.</p></section>;
}
