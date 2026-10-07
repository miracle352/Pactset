import { ArrowRight, CurrencyCircleDollar, LockKey } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { WalletConnection } from "@/components/payments/wallet-connection";
import { EmptyState } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

function paymentStatus(agreement: { status: string; agreement_escrows?: { status: string } | { status: string }[] | null }) {
  const escrow = Array.isArray(agreement.agreement_escrows) ? agreement.agreement_escrows[0] : agreement.agreement_escrows;
  return (escrow?.status ?? agreement.status).replaceAll("_", " ");
}

export default async function WalletSettingsPage() {
  const account = await requireAccount();
  const supabase = await createClient();
  const [{ data: wallet }, { data: agreements }] = await Promise.all([
    supabase.from("wallet_connections").select("public_key,network,wallet_provider,verified_at").eq("user_id", account.userId).eq("network", "TESTNET").eq("active", true).maybeSingle(),
    supabase.from("agreements").select("id,scope,status,amount,currency,provider_role,organizer_id,provider_id,agreement_escrows(status)").order("created_at", { ascending: false }),
  ]);

  return <main className="settings-page page-width wallet-settings-page">
    <header className="wallet-settings-heading"><div><p className="kicker">Account and wallet</p><h1>Wallet &amp; payments</h1><p>Connect a Stellar Testnet wallet for new agreements and review the next payment action. Pactset sign-in controls your account; your wallet approves only the blockchain action you review.</p></div><CurrencyCircleDollar size={42} /></header>
    <div className="wallet-settings-grid"><WalletConnection initialConnection={wallet} /><section className="wallet-prerequisites financial-surface"><p className="kicker">Before payment controls appear</p><h2>Four checks protect an agreement</h2><ol><li>Both parties accept the same current terms.</li><li>Both verify distinct Freighter wallets on Stellar Testnet.</li><li>The organizer creates the agreement-bound escrow.</li><li>The agreement asset is provisioned with a valid conversion path.</li></ol><p className="testnet-note"><LockKey /> Never paste a seed phrase into Pactset. Test assets have no real monetary value.</p></section></div>
    <section className="wallet-agreements"><div className="compact-section-heading"><div><p className="kicker">Your real workspace</p><h2>Agreements with payment controls</h2></div></div>{agreements?.length ? <div className="agreement-grid">{agreements.map((agreement) => <Link className="agreement-card-link operational-card" href={`/workspace/agreements/${agreement.id}/payment`} key={agreement.id}><span className="funding-status">{paymentStatus(agreement)}</span><h3>{agreement.scope}</h3><p>{agreement.amount} {agreement.currency} · {agreement.organizer_id === account.userId ? "You organize" : `You provide ${agreement.provider_role} work`}</p><span className="agreement-link-label">Open wallet and payment details <ArrowRight /></span></Link>)}</div> : <EmptyState title="No real agreements yet" body="Wallet verification is available now, but payment controls belong to accepted agreements. Return to your workspace to publish, offer, or accept current terms." action={<Link href="/workspace">Return to workspace</Link>} />}</section>
  </main>;
}
