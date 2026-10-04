import { EmptyState, WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";

export default async function SupportWorkspace() {
  const account = await requireAccount("support");
  const nav = [{ label: "Assigned cases", href: "/workspace/support" }, { label: "Access boundary", href: "#access" }];
  return <WorkspaceShell workspaceRole="support" account={account} nav={nav}><WorkspaceHeading eyebrow="Assigned support" title="Case workspace" description="Only server-assigned support accounts can enter. Dispute tools are not available yet." /><section className="workspace-section"><EmptyState title="No cases are assigned" body="Pactset will show only cases explicitly assigned to this support account. There is no global customer-data browser." /></section><section id="access" className="workspace-section"><div className="compact-section-heading"><h2>Access boundary</h2></div><p className="section-copy">Support assignment is controlled outside public signup. Evidence, conversations, dispute actions, and adjudication remain unavailable until their audited workflows are implemented.</p></section></WorkspaceShell>;
}
