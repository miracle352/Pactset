"use client";

import { useActionState } from "react";
import { addSupportCaseMessage, openSupportCase } from "@/app/workspace/support/actions";
import { initialFormState } from "@/lib/form-state";

export function OpenSupportCaseForm({ agreementId }: { agreementId: string }) {
  const [state, action, pending] = useActionState(openSupportCase, initialFormState);
  return <form action={action} className="case-form"><input type="hidden" name="agreementId" value={agreementId} /><label><span>Reason for support</span><textarea name="reason" rows={4} minLength={10} maxLength={4000} required placeholder="Describe the disputed work, milestone, and outcome you need reviewed." /></label><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Opening case…" : "Open support case"}</button>{state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</form>;
}

export function SupportCaseMessageForm({ caseId, agreementId }: { caseId: string; agreementId: string }) {
  const [state, action, pending] = useActionState(addSupportCaseMessage, initialFormState);
  return <form action={action} className="case-form"><input type="hidden" name="caseId" value={caseId} /><input type="hidden" name="agreementId" value={agreementId} /><label><span>Add to this private case</span><textarea name="body" rows={3} maxLength={4000} required /></label><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add message"}</button>{state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</form>;
}
