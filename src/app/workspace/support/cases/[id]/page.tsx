import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceLink, MilestoneActions } from "@/components/payments/payment-actions";
import { WalletConnection } from "@/components/payments/wallet-connection";
import { SupportCaseMessageForm } from "@/components/support/case-forms";
import { WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export default async function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount("support");
  const supabase = await createClient();
  const { data: supportCase } = await supabase.from("support_cases").select("*").eq("id", id).eq("assigned_support_id", account.userId).maybeSingle();
  if (!supportCase) notFound();
  const [{ data: agreement }, { data: escrow }, { data: messages }, { data: events }, { data: wallet }] = await Promise.all([
    supabase.from("agreements").select("*").eq("id", supportCase.agreement_id).maybeSingle(),
    supabase.from("agreement_escrows").select("*").eq("agreement_id", supportCase.agreement_id).maybeSingle(),
    supabase.from("support_case_messages").select("*").eq("case_id", id).order("created_at"),
    supabase.from("support_case_events").select("*").eq("case_id", id).order("created_at"),
    supabase.from("wallet_connections").select("public_key,network,wallet_provider,verified_at").eq("user_id", account.userId).eq("network", "TESTNET").eq("active", true).maybeSingle(),
  ]);
  if (!agreement) notFound();
  const { data: milestones } = escrow ? await supabase.from("escrow_milestones").select("*").eq("escrow_id", escrow.id).order("milestone_index") : { data: null };
  const milestoneIds = (milestones ?? []).map((item) => item.id);
  const { data: evidence } = milestoneIds.length
    ? await supabase.from("milestone_evidence").select("id,milestone_id,note,media_type,status,created_at").in("milestone_id", milestoneIds).order("created_at", { ascending: false })
    : { data: null };

  return <WorkspaceShell workspaceRole="support" account={account} nav={[{ label: "Assigned cases", href: "/workspace/support" }, { label: "Current case", href: `/workspace/support/cases/${id}` }]}>
    <Link className="back-link payment-back" href="/workspace/support"><ArrowLeft /> Back to assigned cases</Link>
    <WorkspaceHeading eyebrow={`Case ${supportCase.status.replaceAll("_", " ")}`} title={agreement.scope} description="Review the accepted terms, private case record, submitted evidence, and only the on-chain actions authorized for the disclosed resolver." />
    <div className="payment-layout">
      <div className="payment-primary">
        <section className="financial-surface"><p className="kicker">Case reason</p><h2>{supportCase.reason}</h2><p>{agreement.amount} {agreement.currency} · agreement version {agreement.offer_version}</p></section>
        <section className="financial-surface"><p className="kicker">Private case messages</p>{messages?.length ? <ol className="case-message-list">{messages.map((message) => <li key={message.id}><p>{message.body}</p><span>{new Date(message.created_at).toLocaleString()}</span></li>)}</ol> : <p>No follow-up messages yet.</p>}<SupportCaseMessageForm caseId={id} agreementId={agreement.id} /></section>
        <section className="financial-surface"><p className="kicker">Authorized evidence</p>{evidence?.length ? <ul className="evidence-list">{evidence.map((item) => <li key={item.id}><strong>{item.status}</strong><p>{item.note}</p>{item.media_type && <EvidenceLink agreementId={agreement.id} evidenceId={item.id} />}</li>)}</ul> : <p>No evidence is attached to this agreement yet.</p>}</section>
        <section className="milestone-panel glass-panel">
          <div className="compact-section-heading"><div><p className="kicker">Disputed milestones</p><h2>Resolver actions</h2></div><LockKey /></div>
          {milestones?.length ? <ol className="payment-timeline">{milestones.map((milestone) => <li key={milestone.id}><span className="timeline-marker"><LockKey /></span><div><strong>{milestone.label}</strong><p>{milestone.status === "disputed" ? "Frozen. A reasoned resolver decision may release or refund only this unreleased milestone." : `Status: ${milestone.status}. No resolver action is available.`}</p><MilestoneActions agreementId={agreement.id} wallet={wallet} viewerRole="support" milestone={milestone} /></div><span>{Number(milestone.amount) / 10_000_000} {agreement.currency}</span></li>)}</ol> : <p>The escrow has not been created yet.</p>}
        </section>
      </div>
      <aside className="payment-sidebar">
        <WalletConnection initialConnection={wallet} />
        <section className="financial-surface"><p className="kicker">Resolver boundary</p><h2>Two checks, every time</h2><p>This case must be assigned to your support account, and the connected wallet must equal the resolver address fixed in the escrow. A database role alone cannot move funds.</p>{escrow && <dl className="signing-details"><div><dt>Contract</dt><dd>{escrow.contract_address}</dd></div><div><dt>Resolver</dt><dd>{escrow.resolver_public_key}</dd></div></dl>}</section>
        <section className="financial-surface"><p className="kicker">Audit trail</p><ol className="case-event-list">{events?.map((event) => <li key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol></section>
      </aside>
    </div>
  </WorkspaceShell>;
}
