import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EmptyState, WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export default async function SupportWorkspace() {
  const account = await requireAccount("support");
  const supabase = await createClient();
  const { data: cases } = await supabase.from("support_cases").select("id,agreement_id,status,reason,created_at,agreements(scope,currency,amount)").eq("assigned_support_id", account.userId).order("created_at", { ascending: false });
  const nav = [{ label: "Assigned cases", href: "/workspace/support" }, { label: "Access boundary", href: "#access" }];
  return <WorkspaceShell workspaceRole="support" account={account} nav={nav}><WorkspaceHeading eyebrow="Assigned support" title="Case workspace" description="Review only cases assigned by Pactset’s server-side resolver routing." /><section className="workspace-section">{cases?.length ? <div className="record-list">{cases.map((item) => { const agreement = item.agreements as unknown as { scope?: string; currency?: string; amount?: number } | null; return <Link href={`/workspace/support/cases/${item.id}`} key={item.id}><div><strong>{agreement?.scope ?? "Assigned agreement"}</strong><p>{item.reason}</p></div><span>{item.status}</span><ArrowRight /></Link>; })}</div> : <EmptyState title="No cases are assigned" body="Pactset shows only cases explicitly assigned to this support account. There is no global customer-data browser." />}</section><section id="access" className="workspace-section"><div className="compact-section-heading"><h2>Access boundary</h2></div><p className="section-copy">A support role alone cannot reveal records or move funds. The case must be assigned to this account, and on-chain resolution additionally requires the exact resolver wallet disclosed by the accepted escrow.</p></section></WorkspaceShell>;
}
