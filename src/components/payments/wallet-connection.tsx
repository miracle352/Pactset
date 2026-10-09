"use client";

import { ArrowSquareOut, CheckCircle, LinkBreak, SpinnerGap, WarningCircle, Wallet, X } from "@phosphor-icons/react";
import { getNetwork, isConnected, requestAccess, signMessage } from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Connection = { public_key: string; network: string; wallet_provider: string; verified_at: string } | null;
type State = "disconnected" | "checking" | "approval-required" | "signing" | "verifying" | "wrong-network" | "cancelled" | "unavailable" | "timeout" | "confirmed" | "server-error";

const stateCopy: Record<State, string> = {
  disconnected: "Choose a supported wallet when you are ready to authorize Testnet actions.",
  checking: "Checking whether Freighter is available…",
  "approval-required": "Approve Pactset access in Freighter. This does not authorize a payment.",
  signing: "Sign the ownership message in Freighter. It cannot move funds.",
  verifying: "Verifying the single-use ownership challenge with Pactset…",
  "wrong-network": "Switch Freighter to Stellar Testnet, then try again. Pactset will not use Mainnet.",
  cancelled: "You cancelled the wallet request. Nothing was connected or submitted.",
  unavailable: "Freighter is not available in this browser. Install the extension on desktop, then reload this page.",
  timeout: "The wallet did not respond in time. Unlock Freighter and try again.",
  confirmed: "Wallet ownership verified on Stellar Testnet.",
  "server-error": "Pactset could not verify this wallet. Try again; no transaction was submitted.",
};

function abbreviated(value: string) { return `${value.slice(0, 7)}…${value.slice(-7)}`; }
function signatureString(value: string | Buffer) {
  if (typeof value === "string") return value;
  const bytes = new Uint8Array(value); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function withTimeout<T>(promise: Promise<T>, milliseconds = 45_000) {
  return Promise.race<T>([promise, new Promise<T>((_, reject) => globalThis.setTimeout(() => reject(new Error("WALLET_TIMEOUT")), milliseconds))]);
}
function walletCancelled(error: unknown) {
  const value = error instanceof Error ? error.message : String(error ?? "");
  return /reject|declin|cancel|denied/i.test(value);
}

export function WalletConnection({ initialConnection }: { initialConnection: Connection }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [connection, setConnection] = useState(initialConnection);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [state, setState] = useState<State>(initialConnection ? "confirmed" : "disconnected");
  const [message, setMessage] = useState(initialConnection ? stateCopy.confirmed : stateCopy.disconnected);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const restore = () => { setPickerOpen(false); openerRef.current?.focus(); };
    dialog.addEventListener("close", restore);
    return () => dialog.removeEventListener("close", restore);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pickerOpen && !dialog.open) dialog.showModal();
    if (!pickerOpen && dialog.open) dialog.close();
  }, [pickerOpen]);

  function update(next: State, detail?: string) { setState(next); setMessage(detail || stateCopy[next]); }
  function openPicker() { setPickerOpen(true); }
  function closePicker() { setPickerOpen(false); }

  async function connectFreighter() {
    closePicker(); update("checking");
    try {
      const availability = await withTimeout(isConnected());
      if (availability.error || !availability.isConnected) { update("unavailable"); return; }
      update("approval-required");
      const access = await withTimeout(requestAccess());
      if (access.error || !access.address) { update(walletCancelled(access.error) ? "cancelled" : "server-error", access.error?.message || undefined); return; }
      const network = await withTimeout(getNetwork());
      if (network.error || network.network !== "TESTNET" || network.networkPassphrase !== Networks.TESTNET) { update("wrong-network"); return; }
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke("wallet-auth", { body: { action: "challenge", publicKey: access.address, network: "TESTNET" } });
      if (challengeError || !challengeData?.challenge) { update("server-error", challengeData?.error || challengeError?.message); return; }
      update("signing");
      const signed = await withTimeout(signMessage(challengeData.challenge, { address: access.address, networkPassphrase: Networks.TESTNET }));
      if (signed.error || !signed.signedMessage || signed.signerAddress !== access.address) { update(walletCancelled(signed.error) ? "cancelled" : "server-error", signed.error?.message || "The ownership signature did not match the selected account."); return; }
      update("verifying");
      const { data: verified, error: verifyError } = await supabase.functions.invoke("wallet-auth", { body: { action: "verify", challengeId: challengeData.challengeId, publicKey: access.address, network: "TESTNET", walletProvider: "Freighter", signature: signatureString(signed.signedMessage) } });
      if (verifyError || !verified?.connection) { update("server-error", verified?.error || verifyError?.message); return; }
      localStorage.removeItem("pactset-wallet-disconnected-v1");
      setConnection(verified.connection); update("confirmed"); router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "WALLET_TIMEOUT") update("timeout");
      else if (walletCancelled(error)) update("cancelled");
      else update("server-error", error instanceof Error ? error.message : undefined);
    }
  }

  async function disconnectWallet() {
    if (!connection || pending) return;
    update("verifying", "Disconnecting this wallet from new Pactset actions…");
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("wallet-auth", { body: { action: "disconnect", publicKey: connection.public_key, network: "TESTNET" } });
    if (error || !data?.disconnected) { update("server-error", data?.error || error?.message); return; }
    localStorage.setItem("pactset-wallet-disconnected-v1", "true");
    setConnection(null); update("disconnected", "Wallet disconnected from new actions. Your Pactset account is still signed in and existing escrows are unchanged."); router.refresh();
  }

  const pending = ["checking", "approval-required", "signing", "verifying"].includes(state);
  const alert = ["wrong-network", "cancelled", "unavailable", "timeout", "server-error"].includes(state);
  return <section className="wallet-card glass-panel" aria-labelledby="wallet-title">
    <div className="wallet-card-heading"><span className="section-icon"><Wallet /></span><div><p className="kicker">Transaction authorization</p><h2 id="wallet-title">Stellar Testnet wallet</h2></div></div>
    {connection ? <div className="wallet-identity"><CheckCircle weight="fill" /><div><strong>{abbreviated(connection.public_key)}</strong><span>{connection.wallet_provider} · verified for new Testnet actions</span></div></div> : <div className="wallet-identity is-disconnected"><LinkBreak /><div><strong>Not connected</strong><span>Your Pactset account remains signed in independently.</span></div></div>}
    <p className={`wallet-message ${state}`} role={alert ? "alert" : "status"}>{pending ? <SpinnerGap className="spinner" /> : state === "confirmed" ? <CheckCircle /> : <WarningCircle />}{message}</p>
    <div className="wallet-button-row"><button ref={openerRef} className={`button ${connection ? "button-secondary" : "button-primary"}`} type="button" onClick={openPicker} disabled={pending}>{connection ? "Verify a different wallet" : "Select wallet"}</button>{connection && <button className="text-button" type="button" onClick={disconnectWallet} disabled={pending}>Disconnect wallet</button>}</div>
    <p className="field-note">Pactset never asks for a seed phrase. A newly verified wallet becomes active for new actions; existing escrows keep their original participant keys.</p>
    <dialog ref={dialogRef} className="wallet-dialog" aria-labelledby="wallet-dialog-title">
      <div className="wallet-dialog-heading"><div><p className="kicker">Choose a wallet</p><h2 id="wallet-dialog-title">Connect on Stellar Testnet</h2></div><button type="button" className="icon-button" onClick={closePicker} aria-label="Close wallet selection"><X /></button></div>
      <button type="button" className="wallet-choice" onClick={connectFreighter}><span className="freighter-mark" aria-hidden="true"><Image src="https://www.freighter.app/favicon.ico" alt="" width={44} height={44} unoptimized /></span><span><strong>Freighter <em>Recommended</em></strong><small>Complete access, ownership verification, and transaction signing</small></span><span className="wallet-availability">Desktop extension</span></button>
      <div className="wallet-choice is-disabled" aria-disabled="true"><span className="wallet-placeholder" aria-hidden="true">WC</span><span><strong>Mobile and WalletConnect</strong><small>Not enabled until message signing and Pactset verification are implemented end to end</small></span><span className="wallet-availability">Unsupported</span></div>
      <p className="wallet-mobile-note">On a phone, use Pactset to review bookings; the verified wallet flow currently requires Freighter in a desktop browser.</p>
      <a className="text-link" href="https://www.freighter.app/" target="_blank" rel="noreferrer">Install Freighter from its official site <ArrowSquareOut /></a>
    </dialog>
  </section>;
}
