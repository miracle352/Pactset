import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteReplacementForm, ReplacementControls } from "@/components/replacements/replacement-forms";
import { WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export default async function ReplacementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const account = await requireAccount(); const supabase = await createClient();
  const { data: replacement } = await supabase.from("replacement_requests").select("*").eq("id", id).maybeSingle();
  if (!replacement) notFound();
  const organizer = replacement.organizer_id === account.userId;
  const role = organizer ? "organizer" : account.roles.includes("support") ? "support" : replacement.provider_role as "supplier" | "crew";
  const backHref = organizer ? `/workspace/agreements/${replacement.original_agreement_id}/payment` : `/workspace/${role}`;
  const backLabel = organizer ? "Back to original booking" : `Back to ${role} workspace`;
  const [{ data: candidates, error: candidateError }, { data: events }, { data: invitation }] = await Promise.all([
    organizer && replacement.status === "searching" ? supabase.rpc("list_replacement_candidates", { p_replacement_id: id }) : Promise.resolve({ data: [], error: null }),
    supabase.from("replacement_events").select("id,action,reason,details,created_at").eq("replacement_id", id).order("created_at"),
    replacement.replacement_request_id ? supabase.from("requests").select("id,title,status").eq("id", replacement.replacement_request_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return <WorkspaceShell workspaceRole={role} account={account} nav={[{ label: "Workspace", href: `/workspace/${role}` }, { label: "Replacement", href: `/workspace/replacements/${id}` }]}>
    <Link className="back-link" href={backHref}><ArrowLeft />{backLabel}</Link>
    <WorkspaceHeading eyebrow="Replacement search" title={replacement.title} description="The original booking, cancellation terms, dispute, and money remain separate. A replacement is confirmed only after current terms are mutually accepted." />
    <section className="financial-surface replacement-summary"><span className="status-tag">{replacement.status}</span><dl className="finance-breakdown"><div><dt>Original terms</dt><dd>{replacement.original_amount} {replacement.currency}</dd></div><div><dt>Replacement limit</dt><dd>{replacement.budget_limit} {replacement.currency}</dd></div><div><dt>Maximum difference</dt><dd>{Math.max(0, Number(replacement.budget_limit) - Number(replacement.original_amount))} {replacement.currency}</dd></div><div><dt>Window</dt><dd>{new Date(replacement.available_from).toLocaleString()} – {new Date(replacement.available_until).toLocaleString()}</dd></div></dl><p><LockKey /> No disputed, owed, or expected-refund funds are counted as replacement funding.</p></section>
    {organizer && <ReplacementControls replacementId={id} currency={replacement.currency} budgetLimit={Number(replacement.budget_limit)} status={replacement.status} />}
    {organizer && replacement.status === "searching" && <section className="workspace-section"><div className="compact-section-heading"><div><p className="kicker">Eligible now</p><h2>Choose one provider to invite</h2></div></div>{candidateError ? <p className="form-message error">Candidate availability could not be checked. No invitation was sent.</p> : candidates?.length ? <div className="candidate-list">{candidates.map((provider: { provider_id: string; display_name: string; headline: string; inventory_name?: string | null; available_quantity: number }) => <InviteReplacementForm key={`${provider.provider_id}-${provider.inventory_name ?? "crew"}`} replacementId={id} provider={provider} />)}</div> : <div className="empty-state"><h3>No suitable provider is available</h3><p>Try adjusting timing or budget through an acknowledged change. Pactset will not loosen skills, area, or capacity checks silently.</p></div>}</section>}
    {invitation?.id && <section className="workspace-section"><h2>Private invitation</h2><p>{invitation.title} · {invitation.status}</p>{!organizer && <Link className="button button-primary" href={`/workspace/requests/${invitation.id}`}>Review and offer</Link>}</section>}
    <section className="workspace-section"><div className="compact-section-heading"><h2>Audit trail</h2></div><ol className="audit-list">{events?.map((event) => <li key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol></section>
  </WorkspaceShell>;
}
