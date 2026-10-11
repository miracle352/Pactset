"use client";

import { CheckCircle, Copy, CurrencyCircleDollar, LinkBreak, SpinnerGap, WarningCircle, X } from "@phosphor-icons/react";
import { getAddress, getNetwork, isConnected } from "@stellar/freighter-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WalletConnection } from "@/components/payments/wallet-connection";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

type SavedWallet = { public_key: string; network: string; wallet_provider: string; verified_at: string } | null;
type RuntimeState = "idle" | "checking" | "ready" | "unavailable" | "locked" | "wrong-network" | "account-changed" | "disconnected" | "error";

function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-6)}`; }

export function HeaderWalletControl({ savedWallet }: { savedWallet: SavedWallet }) {
  const router = useRouter();
  const [runtime, setRuntime] = useState<RuntimeState>(savedWallet ? "idle" : "disconnected");
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
    setRuntime("disconnected"); setBusy(false); router.refresh();
  }

  const status = !savedWallet ? "Not verified" : runtime === "ready" ? "Ready in browser" : runtime === "idle" || runtime === "checking" ? "Checking wallet" : "Attention needed";
  return <DismissibleDetails className="header-wallet-control" mobileModal>
    <summary aria-label={`Wallet status: ${status}`}><CurrencyCircleDollar aria-hidden="true" /><span>{savedWallet ? shortAddress(savedWallet.public_key) : "Wallet"}</span><small>{status}</small></summary>
    <div className="header-wallet-panel financial-surface" data-sheet-panel role="dialog" aria-label="Wallet status and actions">
      <button className="sheet-close" type="button" data-close-details><X aria-hidden="true" /> Close</button>
      <div className="compact-section-heading"><div><p className="kicker">Wallet &amp; payments</p><h2>{savedWallet ? shortAddress(savedWallet.public_key) : "No verified wallet"}</h2></div>{busy ? <SpinnerGap className="spinner" /> : runtime === "ready" ? <CheckCircle weight="fill" /> : <WarningCircle />}</div>
      {savedWallet ? <>
        <dl className="wallet-runtime-details wallet-runtime-summary"><div><dt>Network</dt><dd>Stellar Testnet</dd></div><div><dt>Ownership</dt><dd>Verified</dd></div><div><dt>Browser</dt><dd>{runtime.replaceAll("-", " ")}</dd></div></dl>
        <button className="text-button" type="button" onClick={copyAddress}><Copy /> {copied ? "Copied" : "Copy full address"}</button>
        <p className="field-note">{refreshedAt ? `Checked at ${refreshedAt}.` : "Browser access has not been checked."} Saved ownership does not approve a transaction.</p>
        <div className="wallet-compact-actions"><button className="button button-secondary button-compact" type="button" onClick={inspectBrowserWallet} disabled={busy}>Refresh</button><WalletConnection initialConnection={savedWallet} compact compactLabel={runtime === "ready" ? "Change wallet" : "Reconnect"} /><button className="button button-danger button-compact" type="button" onClick={disconnect} disabled={busy}>Disconnect</button></div>
      </> : <><p>Your Pactset account is signed in. Connect a separate Stellar Testnet wallet only when you need to authorize payment actions.</p><WalletConnection initialConnection={null} compact /><Link className="text-link" href="/settings/wallet">Manage wallets</Link></>}
      {runtime === "unavailable" && <p className="form-message error"><LinkBreak /> Freighter is unavailable in this browser.</p>}
      {runtime === "locked" && <p className="form-message error"><WarningCircle /> Freighter needs to be unlocked or access approved.</p>}
      {runtime === "wrong-network" && <p className="form-message error"><WarningCircle /> Switch Freighter to Stellar Testnet.</p>}
      {runtime === "account-changed" && <p className="form-message error"><WarningCircle /> The active Freighter account differs from the verified address. Existing escrows remain unchanged.</p>}
      {runtime === "error" && <p className="form-message error"><WarningCircle /> Wallet status could not be refreshed. No transaction was submitted.</p>}
      {savedWallet && <Link className="button button-secondary manage-wallets-link" href="/settings/wallet">Manage wallets</Link>}
    </div>
  </DismissibleDetails>;
}
