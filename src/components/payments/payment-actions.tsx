"use client";

import { ArrowSquareOut, CheckCircle, FileArrowUp, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { signTransaction } from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

type Wallet = { public_key: string; network: string; wallet_provider: string; verified_at: string } | null;
type Milestone = { id: string; milestone_index: number; label: string; amount: number | string; status: string };
type Quote = { id: string; inputAsset: string; outputAsset: string; expectedInput: string; maximumInput: string; exactOutput: string; feeStroops: number; slippageBps: number; expiresAt: string; rateSource: string };
type Prepared = { transaction: { id: string; status: string; tx_hash?: string | null }; xdr?: string; details: Record<string, unknown> };

class PaymentError extends Error {
  code: string;
  payload: Record<string, unknown>;
  constructor(payload: Record<string, unknown>) {
    super(String(payload.error ?? "Payment request failed"));
    this.code = String(payload.code ?? "request_failed");
    this.payload = payload;
  }
}

async function paymentCall(body: Record<string, unknown>) {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new PaymentError({ error: "Your session expired. Sign in again.", code: "session_expired" });
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/stellar-payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new PaymentError(payload);
  return payload;
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function ReviewDetails({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && typeof value !== "object");
  return <dl className="signing-details">{rows.map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{String(value)}</dd></div>)}</dl>;
}

function TransactionControl({ agreementId, wallet, label, transactionAction, milestoneIndex, feedback, resolution, onConfirmed }: { agreementId: string; wallet: Wallet; label: string; transactionAction: string; milestoneIndex?: number; feedback?: string; resolution?: "release" | "refund"; onConfirmed?: () => void }) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [state, setState] = useState<"idle" | "preparing" | "review" | "signing" | "pending" | "confirmed" | "failed">("idle");
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);

  async function prepare() {
    if (!wallet) return;
    setState("preparing");
    setMessage("Preparing a Testnet transaction without signing it…");
    try {
      key.current ??= idempotencyKey(transactionAction);
      const payload = await paymentCall({ action: "prepare", agreementId, transactionAction, milestoneIndex, feedback, resolution, idempotencyKey: key.current });
      setPrepared(payload as unknown as Prepared);
      setState("review");
      setMessage("Review every detail before asking Freighter to sign.");
    } catch (error) {
      key.current = null;
      setPrepared(null);
      setState("failed");
      setMessage(error instanceof Error ? error.message : "The transaction could not be prepared.");
      key.current = null;
    }
  }

  async function signAndSubmit() {
    if (!wallet || !prepared?.xdr) return;
    setState("signing");
    setMessage("Waiting for your Freighter approval. No seed phrase is needed.");
    try {
      const signed = await signTransaction(prepared.xdr, { address: wallet.public_key, networkPassphrase: Networks.TESTNET });
      if (signed.error || !signed.signedTxXdr || signed.signerAddress !== wallet.public_key) throw new PaymentError({ error: "The wallet signature was rejected. Nothing was submitted.", code: "signature_rejected" });
      setState("pending");
      setMessage("Signed. The hash is saved; waiting for Testnet confirmation…");
      let payload = await paymentCall({ action: "submit", agreementId, transactionId: prepared.transaction.id, signedXdr: signed.signedTxXdr });
      for (let attempt = 0; attempt < 8 && (payload.transaction as { status?: string })?.status === "pending"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const result = await paymentCall({ action: "reconcile" });
        const match = (result.reconciled as Array<{ id: string; status: string }> | undefined)?.find((item) => item.id === prepared.transaction.id);
        if (match) payload = { ...payload, transaction: match };
      }
      const transaction = payload.transaction as { status?: string; tx_hash?: string };
      if (transaction?.status !== "confirmed") {
        setState("pending");
        setMessage("Still pending. It is safe to refresh or retry reconciliation; the saved hash prevents a duplicate payment.");
        return;
      }
      setState("confirmed");
      setMessage("Confirmed on Stellar Testnet.");
      (onConfirmed ?? router.refresh)();
    } catch (error) {
      key.current = null;
      setPrepared(null);
      setState("failed");
      setMessage(error instanceof Error ? error.message : "The signed transaction failed.");
    }
  }

  if (!wallet) return <button className="button button-secondary" type="button" disabled>Connect wallet to {label.toLowerCase()}</button>;
  return <div className={`transaction-control is-${state}`}>
    {state !== "review" && state !== "signing" && <button className="button button-secondary" type="button" onClick={prepare} disabled={["preparing", "pending", "confirmed"].includes(state)}>{state === "preparing" ? <><SpinnerGap className="spinner" /> Preparing</> : state === "pending" ? "Confirmation pending" : state === "confirmed" ? "Confirmed" : label}</button>}
    {prepared && (state === "review" || state === "signing") && <div className="signing-review financial-surface"><strong>Review before signing</strong><ReviewDetails details={prepared.details} /><button className="button button-primary" type="button" onClick={signAndSubmit} disabled={state === "signing"}>{state === "signing" ? <><SpinnerGap className="spinner" /> Waiting for Freighter</> : "Sign this transaction"}</button><button className="text-action" type="button" onClick={() => { setPrepared(null); setState("idle"); key.current = null; }} disabled={state === "signing"}>Cancel</button></div>}
    {message && <p className={`transaction-message ${state === "failed" ? "error" : ""}`} role={state === "failed" ? "alert" : "status"}>{state === "confirmed" ? <CheckCircle /> : state === "failed" ? <WarningCircle /> : state === "pending" || state === "preparing" || state === "signing" ? <SpinnerGap className="spinner" /> : null}{message}</p>}
  </div>;
}

export function FundingControl({ agreementId, wallet, onConfirmed }: { agreementId: string; wallet: Wallet; onConfirmed?: () => void }) {
  return <TransactionControl agreementId={agreementId} wallet={wallet} label="Review escrow funding" transactionAction="fund" onConfirmed={onConfirmed} />;
}

export function ConversionControls({ agreementId, wallet, assetCode, assetReady, onConfirmed }: { agreementId: string; wallet: Wallet; assetCode: string; assetReady: boolean; onConfirmed?: () => void }) {
  const router = useRouter();
  const complete = onConfirmed ?? router.refresh;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [needsTrustline, setNeedsTrustline] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function getQuote() {
    setBusy(true);
    setMessage("Finding an exact-output path on Stellar Testnet…");
    try {
      const payload = await paymentCall({ action: "quote", agreementId });
      setQuote(payload.quote as Quote);
      setNeedsTrustline(false);
      setMessage("Quote ready. It expires soon and will be checked again before signing.");
    } catch (error) {
      const paymentError = error as PaymentError;
      setNeedsTrustline(paymentError.payload.requiresTrustline === true || paymentError.code === "missing_trustline");
      setMessage(paymentError.message);
    } finally { setBusy(false); }
  }

  if (!assetReady) return <p className="empty-inline">Test asset setup required. Pactset will not substitute another settlement asset.</p>;
  if (!wallet) return <button className="button button-primary" type="button" disabled>Connect wallet to quote</button>;
  return <div className="conversion-actions">
    {!quote && <button className="button button-primary" type="button" onClick={getQuote} disabled={busy}>{busy ? <><SpinnerGap className="spinner" /> Quoting</> : `Quote XLM → ${assetCode}`}</button>}
    {message && <p className="transaction-message" role="status">{message}</p>}
    {needsTrustline && <TransactionControl agreementId={agreementId} wallet={wallet} label={`Add ${assetCode} trustline`} transactionAction="change_trust" onConfirmed={() => { setNeedsTrustline(false); setMessage("Trustline confirmed. Request a fresh conversion quote."); complete(); }} />}
    {quote && <div className="quote-review financial-surface"><p className="kicker">Expires {new Date(quote.expiresAt).toLocaleTimeString()}</p><h3>{quote.expectedInput} XLM → {quote.exactOutput} {assetCode}</h3><dl><div><dt>Maximum input</dt><dd>{quote.maximumInput} XLM</dd></div><div><dt>Network fee</dt><dd>{quote.feeStroops} stroops</dd></div><div><dt>Slippage protection</dt><dd>{quote.slippageBps} bps</dd></div><div><dt>Rate source</dt><dd>{quote.rateSource}</dd></div></dl><TransactionControl agreementId={agreementId} wallet={wallet} label="Review conversion transaction" transactionAction="convert" onConfirmed={complete} /><button className="text-action" type="button" onClick={() => setQuote(null)}>Discard quote</button></div>}
  </div>;
}

export function MilestoneActions({ agreementId, wallet, role, milestone, onConfirmed }: { agreementId: string; wallet: Wallet; role: string; milestone: Milestone; onConfirmed?: () => void }) {
  const [feedback, setFeedback] = useState("");
  const canSubmit = (role === "supplier" || role === "crew") && ["pending", "correction_requested"].includes(milestone.status);
  const canReview = role === "organizer" && milestone.status === "submitted";
  const canDispute = ["organizer", "supplier", "crew"].includes(role) && !["released", "refunded"].includes(milestone.status);
  const canResolve = role === "support" && milestone.status === "disputed";
  return <div className="milestone-actions">
    {canSubmit && <TransactionControl agreementId={agreementId} wallet={wallet} label="Submit milestone on-chain" transactionAction="submit" milestoneIndex={milestone.milestone_index} onConfirmed={onConfirmed} />}
    {canReview && <><TransactionControl agreementId={agreementId} wallet={wallet} label="Approve and release payment" transactionAction="approve_release" milestoneIndex={milestone.milestone_index} onConfirmed={onConfirmed} /><label className="correction-field"><span>Correction request</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={4000} placeholder="Explain what must be corrected" /></label>{feedback.trim().length >= 3 ? <TransactionControl agreementId={agreementId} wallet={wallet} label="Request corrections" transactionAction="request_correction" milestoneIndex={milestone.milestone_index} feedback={feedback} onConfirmed={onConfirmed} /> : <button className="button button-secondary" type="button" disabled>Explain the correction to continue</button>}</>}
    {canDispute && <TransactionControl agreementId={agreementId} wallet={wallet} label="Open dispute and freeze milestone" transactionAction="dispute" milestoneIndex={milestone.milestone_index} onConfirmed={onConfirmed} />}
    {canResolve && <><TransactionControl agreementId={agreementId} wallet={wallet} label="Resolve: release to provider" transactionAction="resolve" milestoneIndex={milestone.milestone_index} resolution="release" onConfirmed={onConfirmed} /><TransactionControl agreementId={agreementId} wallet={wallet} label="Resolve: refund organizer" transactionAction="resolve" milestoneIndex={milestone.milestone_index} resolution="refund" onConfirmed={onConfirmed} /></>}
  </div>;
}

export function EvidenceUpload({ agreementId, milestoneId, onComplete }: { agreementId: string; milestoneId: string; wallet?: Wallet; onComplete?: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "saving" | "complete" | "failed">("idle");
  const [message, setMessage] = useState("");

  async function upload() {
    if (!note.trim()) return;
    setState(file ? "uploading" : "saving");
    setMessage(file ? "Uploading privately…" : "Saving evidence note…");
    let objectPath: string | null = null;
    try {
      if (file) {
        const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
        if (!allowed.includes(file.type) || file.size > 52_428_800) throw new Error("Choose a JPEG, PNG, WebP, MP4, or WebM file no larger than 50 MB.");
        const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
        objectPath = `${agreementId}/${milestoneId}/${crypto.randomUUID()}.${extension}`;
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Your session expired. Sign in again.");
        const { url, key } = getSupabaseConfig();
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${url}/storage/v1/object/milestone-evidence/${objectPath?.split("/").map(encodeURIComponent).join("/")}`);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.setRequestHeader("apikey", key);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.setRequestHeader("x-upsert", "false");
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Private upload failed. Retry without changing the milestone."));
          xhr.onerror = () => reject(new Error("Private upload was interrupted. Retry when the connection is stable."));
          xhr.send(file);
        });
      }
      setState("saving");
      await paymentCall({ action: "recordEvidence", agreementId, milestoneId, note: note.trim(), objectPath, mediaType: file?.type ?? null, sizeBytes: file?.size ?? null });
      setState("complete");
      setMessage("Evidence submitted privately. This is not organizer approval or payment confirmation.");
      setNote(""); setFile(null); setProgress(0); (onComplete ?? router.refresh)();
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error ? error.message : "Evidence could not be submitted.");
    }
  }

  return <div className="evidence-upload"><label><span>Evidence note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Describe the completed work and what the organizer should review." /></label><label className="file-input"><span>Photo or video (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{state === "uploading" && <div className="upload-progress" role="progressbar" aria-label="Private evidence upload" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}<button className="button button-primary" type="button" onClick={upload} disabled={!note.trim() || state === "uploading" || state === "saving"}>{state === "uploading" || state === "saving" ? <><SpinnerGap className="spinner" /> {state === "uploading" ? `Uploading ${progress}%` : "Saving"}</> : <><FileArrowUp /> Submit private evidence</>}</button>{message && <p className={`transaction-message ${state === "failed" ? "error" : ""}`} role={state === "failed" ? "alert" : "status"}>{message}</p>}</div>;
}

export function ReconcileButton({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <div><button className="button button-secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); try { const result = await paymentCall({ action: "reconcile" }); setMessage(`${(result.reconciled as unknown[] | undefined)?.length ?? 0} pending transaction(s) checked.`); (onComplete ?? router.refresh)(); } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation failed."); } finally { setBusy(false); } }}>{busy ? <><SpinnerGap className="spinner" /> Checking ledger</> : "Reconcile pending transactions"}</button>{message && <p className="transaction-message" role="status">{message}</p>}</div>;
}

export function ExplorerLink({ hash }: { hash: string }) {
  return <a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer">Explorer <ArrowSquareOut /></a>;
}

export function EvidenceLink({ agreementId, evidenceId }: { agreementId: string; evidenceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button className="text-action" type="button" disabled={busy} onClick={async () => { const popup = window.open("about:blank", "_blank"); setBusy(true); setError(""); try { const result = await paymentCall({ action: "evidenceUrl", agreementId, evidenceId }); if (!popup) throw new Error("Allow pop-ups to open this private evidence link."); popup.opener = null; popup.location.href = String(result.signedUrl); } catch (caught) { popup?.close(); setError(caught instanceof Error ? caught.message : "Private media could not be opened."); } finally { setBusy(false); } }}>{busy ? "Preparing private link…" : "View private media (60 seconds)"}</button>{error && <p className="transaction-message error" role="alert">{error}</p>}</>;
}
