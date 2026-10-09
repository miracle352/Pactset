"use client";

import { CheckCircle, Copy, CurrencyCircleDollar, LinkBreak, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { getAddress, getNetwork, isConnected } from "@stellar/freighter-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WalletConnection } from "@/components/payments/wallet-connection";

type SavedWallet = { public_key: string; network: string; wallet_provider: string; verified_at: string } | null;
type RuntimeState = "idle" | "checking" | "ready" | "unavailable" | "locked" | "wrong-network" | "account-changed" | "disconnected" | "error";
type Balance = { asset: string; amount: string };

function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-6)}`; }

export function HeaderWalletControl({ savedWallet }: { savedWallet: SavedWallet }) {
  const router = useRouter();
  const [runtime, setRuntime] = useState<RuntimeState>(savedWallet ? "idle" : "disconnected");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const inspectBrowserWallet = useCallback(async () => {
    if (!savedWallet) return;
    setBusy(true); setRuntime("checking");
    try {
      const available = await isConnected();
      if (available.error || !available.isConnected) { setRuntime("unavailable"); return; }
      const [address, network] = await Promise.all([getAddress(), getNetwork()]);
      if (address.error || !address.address) { setRuntime("locked"); return; }
      if (network.error || network.network !== "TESTNET") { setRuntime("wrong-network"); return; }
      if (address.address !== savedWallet.public_key) { setRuntime("account-changed"); return; }
      setRuntime("ready");
      const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(savedWallet.public_key)}`, { cache: "no-store" });
      if (response.ok) {
        const account = await response.json() as { balances?: Array<{ balance: string; asset_type: string; asset_code?: string }> };
        setBalances((account.balances ?? []).slice(0, 4).map((item) => ({ asset: item.asset_type === "native" ? "XLM" : item.asset_code ?? "Asset", amount: Number(item.balance).toLocaleString(undefined, { maximumFractionDigits: 7 }) })));
      }
      setRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch { setRuntime("error"); }
    finally { setBusy(false); }
  }, [savedWallet]);

  useEffect(() => {
    if (localStorage.getItem("pactset-wallet-disconnected-v1") === "true") return;
    void inspectBrowserWallet();
  }, [inspectBrowserWallet]);

  async function copyAddress() {
    if (!savedWallet) return;
    await navigator.clipboard.writeText(savedWallet.public_key);
    setCopied(true); globalThis.setTimeout(() => setCopied(false), 1800);
  }

  async function disconnect() {
    if (!savedWallet || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("wallet-auth", { body: { action: "disconnect", publicKey: savedWallet.public_key, network: "TESTNET" } });
    if (error || !data?.disconnected) { setRuntime("error"); setBusy(false); return; }
    localStorage.setItem("pactset-wallet-disconnected-v1", "true");
    setRuntime("disconnected"); setBalances([]); setBusy(false); router.refresh();
  }

  const status = !savedWallet ? "Not verified" : runtime === "ready" ? "Ready in browser" : runtime === "idle" || runtime === "checking" ? "Checking wallet" : "Attention needed";
  return <details className="header-wallet-control">
    <summary aria-label={`Wallet status: ${status}`}><CurrencyCircleDollar aria-hidden="true" /><span>{savedWallet ? shortAddress(savedWallet.public_key) : "Wallet"}</span><small>{status}</small></summary>
    <div className="header-wallet-panel financial-surface">
      <div className="compact-section-heading"><div><p className="kicker">Wallet &amp; payments</p><h2>{savedWallet ? shortAddress(savedWallet.public_key) : "No verified wallet"}</h2></div>{busy ? <SpinnerGap className="spinner" /> : runtime === "ready" ? <CheckCircle weight="fill" /> : <WarningCircle />}</div>
      {savedWallet ? <>
        <dl className="wallet-runtime-details"><div><dt>Provider</dt><dd>{savedWallet.wallet_provider}</dd></div><div><dt>Network</dt><dd>Stellar Testnet</dd></div><div><dt>Ownership</dt><dd>Verified {new Date(savedWallet.verified_at).toLocaleDateString()}</dd></div><div><dt>Browser</dt><dd>{runtime.replaceAll("-", " ")}</dd></div></dl>
        <button className="text-button" type="button" onClick={copyAddress}><Copy /> {copied ? "Copied" : "Copy full address"}</button>
        {balances.length ? <fieldset className="wallet-mini-balances"><legend>Wallet balances</legend>{balances.map((balance) => <span key={balance.asset}><strong>{balance.amount}</strong> {balance.asset}</span>)}</fieldset> : <p className="field-note">Balances appear after the saved address is available in this browser. They are read from Stellar Testnet.</p>}
        <p className="field-note">{refreshedAt ? `Last refreshed ${refreshedAt}.` : "Not refreshed in this browser."} A saved verification does not approve a transaction.</p>
        <div className="wallet-compact-actions"><button className="button button-secondary" type="button" onClick={inspectBrowserWallet} disabled={busy}>Refresh status</button><WalletConnection initialConnection={savedWallet} compact compactLabel={runtime === "ready" ? "Change wallet" : "Reconnect wallet"} /><button className="button button-danger" type="button" onClick={disconnect} disabled={busy}>Disconnect</button></div>
      </> : <><p>Your Pactset account is signed in. Connect a separate Stellar Testnet wallet only when you need to authorize payment actions.</p><WalletConnection initialConnection={null} compact /><Link className="text-link" href="/settings/wallet">Manage wallets</Link></>}
      {runtime === "unavailable" && <p className="form-message error"><LinkBreak /> Freighter is unavailable in this browser.</p>}
      {runtime === "locked" && <p className="form-message error"><WarningCircle /> Freighter needs to be unlocked or access approved.</p>}
      {runtime === "wrong-network" && <p className="form-message error"><WarningCircle /> Switch Freighter to Stellar Testnet.</p>}
      {runtime === "account-changed" && <p className="form-message error"><WarningCircle /> The active Freighter account differs from the verified address. Existing escrows remain unchanged.</p>}
      {runtime === "error" && <p className="form-message error"><WarningCircle /> Wallet status could not be refreshed. No transaction was submitted.</p>}
      {savedWallet && <Link className="text-link" href="/settings/wallet">Manage wallets</Link>}
    </div>
  </details>;
}
