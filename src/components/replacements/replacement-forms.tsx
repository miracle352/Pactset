"use client";

import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState } from "react";
import { createReplacement, inviteReplacement } from "@/app/workspace/replacements/actions";
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
