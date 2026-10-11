"use client";

import { CheckCircle, CurrencyCircleDollar, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { approveEventBudget, saveEventBudget } from "@/app/workspace/organizer/events/actions";
import { initialFormState } from "@/lib/form-state";

export type BudgetVersion = { id: string; version: number; status: string; currency: string; total_amount: number; contingency_amount: number; allocations: Array<{ category: string; amount: number }>; assumptions: string[]; proposal_source: string; approved_at: string | null; created_at: string };

function FormMessage({ state }: { state: typeof initialFormState }) {
  if (!state.message) return null;
  return <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}</p>;
}

function ApproveBudget({ eventId, budgetId }: { eventId: string; budgetId: string }) {
  const [state, action, pending] = useActionState(approveEventBudget.bind(null, eventId, budgetId), initialFormState);
  return <form action={action} className="budget-approve"><FormMessage state={state} /><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Approving…" : "Approve this planning budget"}</button></form>;
}

export function EventBudgetPlanner({ eventId, currency, current, history }: { eventId: string; currency: string; current?: BudgetVersion; history: BudgetVersion[] }) {
  const [state, action, pending] = useActionState(saveEventBudget.bind(null, eventId), initialFormState);
  const get = (key: string, fallback = "") => state.fields?.[key] ?? fallback;
  const allocations = current?.allocations?.map((item) => `${item.category}: ${item.amount}`).join("\n") ?? "Venue: 0\nFood: 0\nEquipment: 0\nCrew: 0";
  return <section id="event-budget" className="workspace-section budget-planner financial-surface">
    <div className="compact-section-heading"><div><p className="kicker">Event budget</p><h2>Build, edit, then approve the plan</h2><p>Approval records a planning version. It does not accept an offer, change signed terms, or move Testnet funds.</p></div><CurrencyCircleDollar /></div>
    <div className="budget-state-grid"><div><span>Planning currency</span><strong>{currency}</strong></div><div><span>Current version</span><strong>{current ? `v${current.version} · ${current.status}` : "No version"}</strong></div><div><span>Total</span><strong>{current ? `${current.total_amount} ${currency}` : "Not set"}</strong></div><div><span>Contingency</span><strong>{current ? `${current.contingency_amount} ${currency}` : "Not set"}</strong></div></div>
    <form action={action} className="budget-form">
      <label>Total planning budget<input name="totalAmount" type="number" min="0" step="0.01" defaultValue={get("totalAmount", String(current?.total_amount ?? 0))} required /></label>
      <label>Protected contingency<input name="contingencyAmount" type="number" min="0" step="0.01" defaultValue={get("contingencyAmount", String(current?.contingency_amount ?? 0))} required /></label>
      <label className="wide">Editable allocations, one <code>category: amount</code> per line<textarea name="allocations" rows={6} defaultValue={get("allocations", allocations)} required /></label>
      <label className="wide">Assumptions<textarea name="assumptions" rows={4} defaultValue={get("assumptions", current?.assumptions?.join("\n") ?? "Amounts are planning limits, not accepted provider quotes.")} /></label>
      <FormMessage state={state} />
      <div className="form-actions"><button className="button button-secondary" type="submit" name="source" value="rule_based" disabled={pending}><CurrencyCircleDollar /> {pending ? "Saving…" : "Build rule-based draft"}</button><button className="button button-primary" type="submit" name="source" value="manual" disabled={pending}>{pending ? "Saving…" : "Save edited draft"}</button></div>
    </form>
    {current?.status === "draft" && <ApproveBudget eventId={eventId} budgetId={current.id} />}
    {current?.assumptions?.length ? <div className="budget-assumptions"><h3>Assumptions to review</h3><ul>{current.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    {history.length > 1 && <details className="budget-history"><summary>Budget version history</summary><ol>{history.map((item) => <li key={item.id}><strong>Version {item.version}</strong><span>{item.status} · {item.total_amount} {item.currency} · {item.proposal_source.replaceAll("_", " ")}</span></li>)}</ol></details>}
  </section>;
}
