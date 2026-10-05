"use client";

import { CheckCircle, LinkBreak, SpinnerGap, WarningCircle, Wallet } from "@phosphor-icons/react";
import { getAddress, getNetwork, signMessage } from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Connection = { public_key: string; network: string; wallet_provider: string; verified_at: string } | null;
type State = "disconnected" | "pending" | "wrong-network" | "rejected" | "confirmed" | "error";

function abbreviated(value: string) {
  return `${value.slice(0, 7)}…${value.slice(-7)}`;
}

function signatureString(value: string | Buffer) {
  if (typeof value === "string") return value;
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function WalletConnection({ initialConnection }: { initialConnection: Connection }) {
  const [connection, setConnection] = useState(initialConnection);
  const [state, setState] = useState<State>(initialConnection ? "confirmed" : "disconnected");
  const [message, setMessage] = useState(initialConnection ? "Wallet ownership verified on Stellar Testnet." : "Connect a Testnet wallet when you are ready to authorize a transaction.");

  async function connect() {
    setState("pending");
    setMessage("Checking Freighter and the selected network…");
    try {
      const [addressResult, networkResult] = await Promise.all([getAddress(), getNetwork()]);
      if (addressResult.error || !addressResult.address) {
        setState("rejected");
        setMessage("Freighter did not provide an account. Install or unlock it, then approve access.");
        return;
      }
      if (networkResult.error || networkResult.network !== "TESTNET" || networkResult.networkPassphrase !== Networks.TESTNET) {
        setState("wrong-network");
        setMessage("Switch Freighter to Stellar Testnet. Pactset will never submit this flow to Mainnet.");
        return;
      }
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke("wallet-auth", {
        body: { action: "challenge", publicKey: addressResult.address, network: "TESTNET" },
      });
      if (challengeError || !challengeData?.challenge) throw new Error(challengeData?.error ?? "The signing challenge could not be created.");
      setMessage("Review the ownership message in Freighter. It cannot transfer funds.");
      const signed = await signMessage(challengeData.challenge, { address: addressResult.address, networkPassphrase: Networks.TESTNET });
      if (signed.error || !signed.signedMessage || signed.signerAddress !== addressResult.address) {
        setState("rejected");
        setMessage("The ownership signature was rejected. Nothing was connected or submitted.");
        return;
      }
      const { data: verified, error: verifyError } = await supabase.functions.invoke("wallet-auth", {
        body: {
          action: "verify",
          challengeId: challengeData.challengeId,
          publicKey: addressResult.address,
          network: "TESTNET",
          walletProvider: "Freighter",
          signature: signatureString(signed.signedMessage),
        },
      });
      if (verifyError || !verified?.connection) throw new Error(verified?.error ?? "Wallet ownership could not be verified.");
      setConnection(verified.connection);
      setState("confirmed");
      setMessage("Wallet ownership verified on Stellar Testnet.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Wallet connection failed. Try again.");
    }
  }

  return <section className="wallet-card glass-panel" aria-labelledby="wallet-title"><div className="wallet-card-heading"><span className="section-icon"><Wallet /></span><div><p className="kicker">Transaction authorization</p><h2 id="wallet-title">Stellar Testnet wallet</h2></div></div>{connection ? <div className="wallet-identity"><CheckCircle weight="fill" /><div><strong>{abbreviated(connection.public_key)}</strong><span>{connection.wallet_provider} · Testnet ownership verified</span></div></div> : <div className="wallet-identity is-disconnected"><LinkBreak /><div><strong>Not connected</strong><span>Your Pactset account remains signed in independently.</span></div></div>}<p className={`wallet-message ${state}`} role={state === "error" || state === "wrong-network" ? "alert" : "status"}>{state === "pending" ? <SpinnerGap className="spinner" /> : state === "confirmed" ? <CheckCircle /> : <WarningCircle />}{message}</p>{!connection && <button className="button button-primary" type="button" onClick={connect} disabled={state === "pending"} aria-busy={state === "pending"}>{state === "pending" ? "Waiting for wallet" : "Connect Freighter"}</button>}<p className="field-note">Pactset never asks for a seed phrase. Connecting proves control of one Testnet account; each transaction still needs its own wallet authorization.</p></section>;
}
