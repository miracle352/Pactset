import { ArrowLeft, ArrowSquareOut, CheckCircle, Clock, CurrencyCircleDollar, LockKey, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WalletConnection } from "@/components/payments/wallet-connection";
import { WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

type MilestoneTerm = { label?: string; title?: string; amount?: number | string };
type LedgerMilestone = { id: string; label: string; amount: number | string; status: string };

const explorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
const displayAmount = (amount: number | string) => Number(amount) / 10_000_000;
const statusCopy: Record<string, string> = {
  submitted: "Evidence submitted — awaiting organizer review.",
  correction_requested: "Organizer requested corrections; no payment was released.",
  disputed: "Disputed — ordinary organizer approval cannot release these funds.",
  released: "Organizer approved and Testnet payment is confirmed.",
  refunded: "The disclosed resolver returned this unreleased amount to the payer.",
  pending: "Work evidence has not been submitted.",
};

export default async function AgreementPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount();
  const supabase = await createClient();
  const [{ data: agreement }, { data: wallet }, { data: escrow }] = await Promise.all([
    supabase.from("agreements").select("*").eq("id", id).maybeSingle(),
    supabase.from("wallet_connections").select("public_key,network,wallet_provider,verified_at").eq("user_id", account.userId).eq("network", "TESTNET").maybeSingle(),
    supabase.from("agreement_escrows").select("*,test_asset_registry(*)").eq("agreement_id", id).maybeSingle(),
  ]);
  if (!agreement) notFound();
  const workspaceRole = agreement.organizer_id === account.userId ? "organizer" : agreement.provider_role;
  if (workspaceRole !== "organizer" && workspaceRole !== "supplier" && workspaceRole !== "crew") notFound();

  const [{ data: milestoneRows }, { data: transactions }] = await Promise.all([
    escrow ? supabase.from("escrow_milestones").select("*").eq("escrow_id", escrow.id).order("milestone_index") : Promise.resolve({ data: null }),
    supabase.from("payment_transactions").select("id,kind,status,tx_hash,confirmed_at").eq("agreement_id", id).order("confirmed_at", { ascending: false }),
  ]);
  const onChainMilestones = (milestoneRows ?? []) as LedgerMilestone[];
  const milestoneIds = onChainMilestones.map((item) => item.id);
  const { data: evidence } = milestoneIds.length
    ? await supabase.from("milestone_evidence").select("id,milestone_id,note,media_type,status,created_at").in("milestone_id", milestoneIds).order("created_at", { ascending: false })
    : { data: null };

  const nav = [
    { label: "Overview", href: `/workspace/${workspaceRole}` },
    { label: "Agreement", href: `/workspace/agreements/${id}/payment` },
    { label: "Evidence", href: "#evidence" },
    { label: "Transactions", href: "#transactions" },
  ];
  const planned = Array.isArray(agreement.milestones) ? agreement.milestones as MilestoneTerm[] : [];
  const asset = escrow?.test_asset_registry as Record<string, unknown> | null | undefined;
  const assetReady = asset?.provisioning_status === "ready" && asset?.liquidity_status === "ready";
  const released = onChainMilestones.filter((item) => item.status === "released").reduce((sum, item) => sum + displayAmount(item.amount), 0);
  const refunded = onChainMilestones.filter((item) => item.status === "refunded").reduce((sum, item) => sum + displayAmount(item.amount), 0);
  const disputed = onChainMilestones.filter((item) => item.status === "disputed").reduce((sum, item) => sum + displayAmount(item.amount), 0);
  const timeline = onChainMilestones.length ? onChainMilestones : planned.length ? planned : [{ label: "Complete agreed work", amount: agreement.amount }];

  return <WorkspaceShell workspaceRole={workspaceRole} account={account} nav={nav}>
    <Link className="back-link payment-back" href={`/workspace/${workspaceRole}`}><ArrowLeft /> Back to workspace</Link>
    <WorkspaceHeading eyebrow="Agreement payment" title={agreement.scope} description="Track conversion, escrow funding, private evidence, and ledger-confirmed milestone outcomes without mixing them into one balance." />
    <div className="testnet-finance-banner"><WarningCircle /><strong>Stellar Testnet — no real monetary value</strong><span>Pactset-issued test assets are unaffiliated with similarly named real tokens.</span></div>
    <div className="payment-layout"><div className="payment-primary">
      <section className="funding-summary financial-surface" aria-labelledby="funding-title"><div className="compact-section-heading"><div><p className="kicker">Funding summary</p><h2 id="funding-title">{agreement.amount} {agreement.currency}</h2></div><span className={`finance-status ${escrow?.status ?? "awaiting_funding"}`}>{(escrow?.status ?? "awaiting_funding").replaceAll("_", " ")}</span></div><dl className="finance-breakdown"><div><dt>Planned</dt><dd>{agreement.amount} {agreement.currency}</dd></div><div><dt>Committed</dt><dd>{agreement.amount} {agreement.currency}</dd></div><div><dt>Funded</dt><dd>{escrow?.funded_at ? `${agreement.amount} ${agreement.currency}` : `0 ${agreement.currency}`}</dd></div><div><dt>Released</dt><dd>{released} {agreement.currency}</dd></div><div><dt>Refunded</dt><dd>{refunded} {agreement.currency}</dd></div><div><dt>Disputed</dt><dd>{disputed} {agreement.currency}</dd></div></dl><p>Conversion and escrow funding are separate recoverable transactions. A completed conversion is never repeated automatically if funding fails.</p></section>
      <section className="milestone-panel glass-panel"><div className="compact-section-heading"><div><p className="kicker">Milestone timeline</p><h2>Evidence, approval, payment</h2></div><LockKey /></div><ol className="payment-timeline">{timeline.map((milestone, index) => { const status = "status" in milestone ? String(milestone.status) : "planned"; return <li key={("id" in milestone && String(milestone.id)) || index}><span className="timeline-marker">{status === "released" ? <CheckCircle /> : <Clock />}</span><div><strong>{String(milestone.label ?? ("title" in milestone ? milestone.title : undefined) ?? `Milestone ${index + 1}`)}</strong><p>{statusCopy[status] ?? "Planned in the accepted agreement."}</p></div><span>{"status" in milestone ? displayAmount(milestone.amount) : Number(milestone.amount ?? 0)} {agreement.currency}</span></li>; })}</ol></section>
      <section id="evidence" className="evidence-panel financial-surface"><p className="kicker">Private work evidence</p><h2>Evidence is not approval</h2><p>Notes and media stay in private storage. A submission, organizer approval, and confirmed payment are separate states.</p>{evidence?.length ? <ul className="evidence-list">{evidence.map((item) => <li key={item.id}><strong>{item.status.replaceAll("_", " ")}</strong><p>{item.note}</p><span>{item.media_type ?? "Note only"} · private object</span></li>)}</ul> : <p className="empty-inline">No private evidence is visible for this agreement.</p>}<button className="button button-secondary" type="button" disabled title="The browser upload action is not connected yet">Submit new evidence</button><span className="action-requirement">The private upload policy is verified; browser upload and correction controls remain incomplete.</span></section>
    </div><aside className="payment-sidebar">
      <WalletConnection initialConnection={wallet} />
      <section className="conversion-card glass-panel"><CurrencyCircleDollar /><p className="kicker">XLM conversion</p><h2>{agreement.currency}</h2>{assetReady ? <p>Illustrative Pactset-seeded Testnet liquidity is registered. Quotes expire and must show exact input, output, fee, and slippage before signing.</p> : <p>This agreement’s exact asset is not ready. Pactset will not silently substitute TUSD or another asset.</p>}<button className="button button-primary" type="button" disabled>{!asset ? "Test asset setup required" : !assetReady ? "Conversion unavailable" : !wallet ? "Connect wallet to quote" : "Wallet quote action incomplete"}</button><span className="action-requirement">The verified journey used the local Testnet operator script; the wallet-signed browser quote action is not complete.</span></section>
      <section id="transactions" className="transaction-card financial-surface"><p className="kicker">Confirmed transaction details</p>{transactions?.length ? <ul className="transaction-list">{transactions.map((transaction) => <li key={transaction.id}><div><strong>{transaction.kind.replaceAll("_", " ")}</strong><span>{transaction.status}</span></div>{transaction.tx_hash ? <a href={explorer(transaction.tx_hash)} target="_blank" rel="noreferrer">Explorer <ArrowSquareOut /></a> : <span>Pending ledger hash</span>}</li>)}</ul> : <p>No blockchain transaction has been submitted for this agreement.</p>}</section>
    </aside></div>
  </WorkspaceShell>;
}
