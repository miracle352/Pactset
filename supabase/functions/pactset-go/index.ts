import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Address, BASE_FEE, Contract, Networks, Operation, StrKey, TransactionBuilder, hash, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";

const soroban = new rpc.Server("https://soroban-testnet.stellar.org");
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Origin": "*" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
function fail(message: string, status = 400, code = "invalid_request"): never { throw Object.assign(new Error(message), { status, code }); }
const units = (value: unknown) => { const text = String(value); if (!/^\d+(\.\d{1,7})?$/.test(text)) fail("Invalid Stellar amount"); const [whole, fraction = ""] = text.split("."); return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0")); };
const sha256 = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
const hex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
function contractId(address: string, salt: Uint8Array) { const networkId = hash(new TextEncoder().encode(Networks.TESTNET)); const preimage = xdr.HashIdPreimage.envelopeTypeContractId(new xdr.HashIdPreimageContractId({ networkId, contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(new xdr.ContractIdPreimageFromAddress({ address: new Address(address).toScAddress(), salt })) })); return StrKey.encodeContract(hash(preimage.toXDR())); }
function mapEntry(key: string, value: xdr.ScVal) { return new xdr.ScMapEntry({ key: nativeToScVal(key, { type: "symbol" }), val: value }); }
function bookingVal(booking: Record<string, unknown>) { return xdr.ScVal.scvMap([
  mapEntry("agreement_hash", xdr.ScVal.scvBytes(Buffer.from(String(booking.agreement_hash), "hex"))),
  mapEntry("agreement_version", nativeToScVal(Number(booking.agreement_version), { type: "u32" })),
  mapEntry("amount", nativeToScVal(BigInt(String(booking.amount)), { type: "i128" })),
  mapEntry("escrow", nativeToScVal(String(booking.escrow_contract_address), { type: "address" })),
  mapEntry("provider", nativeToScVal(String(booking.provider_public_key), { type: "address" })),
]); }

async function applyConfirmation(admin: ReturnType<typeof createClient>, tx: Record<string, unknown>, ledger: number | null) {
  const now = new Date().toISOString(); const bundleId = String(tx.bundle_id); const kind = String(tx.kind); const metadata = (tx.action_metadata ?? {}) as Record<string, unknown>;
  await admin.from("pactset_go_transactions").update({ status: "confirmed", ledger, confirmed_at: now, updated_at: now, error_code: null }).eq("id", tx.id).eq("status", "pending");
  if (kind === "contract_deploy") await admin.from("pactset_go_bundles").update({ contract_address: metadata.contractAddress, deployment_tx_hash: tx.tx_hash, status: "collecting_acceptances", last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
  if ((kind === "consent" || kind === "revoke") && tx.booking_id) {
    await admin.from("pactset_go_bookings").update({ consent_status: kind === "consent" ? "accepted" : "revoked", consent_tx_hash: tx.tx_hash, consented_at: kind === "consent" ? now : null }).eq("id", tx.booking_id);
    const { data: bookings } = await admin.from("pactset_go_bookings").select("consent_status").eq("bundle_id", bundleId);
    const status = bookings?.length && bookings.every((item) => item.consent_status === "accepted") ? "awaiting_funds" : "collecting_acceptances";
    await admin.from("pactset_go_bundles").update({ status, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
  }
  if (kind === "reserve") await admin.from("pactset_go_bundles").update({ status: "ready_to_activate", reserve_tx_hash: tx.tx_hash, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
  if (kind === "activate") {
    await admin.from("pactset_go_bundles").update({ status: "active", activation_tx_hash: tx.tx_hash, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
    const { data: bookings } = await admin.from("pactset_go_bookings").select("escrow_id").eq("bundle_id", bundleId);
    for (const booking of bookings ?? []) await admin.from("agreement_escrows").update({ status: "funded", funding_tx_hash: tx.tx_hash, funded_at: now, last_reconciled_at: now, updated_at: now }).eq("id", booking.escrow_id).eq("status", "awaiting_funding");
  }
  if (kind === "expire") {
    await admin.from("pactset_go_bundles").update({ status: metadata.targetStatus, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
    if (metadata.targetStatus === "expired") await admin.from("pactset_go_bookings").update({ consent_status: "expired" }).eq("bundle_id", bundleId);
  }
  if (kind === "refund") await admin.from("pactset_go_bundles").update({ status: "refunded", refund_tx_hash: tx.tx_hash, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
  if (kind === "cancel") await admin.from("pactset_go_bundles").update({ status: "cancelled", refund_tx_hash: tx.tx_hash, last_reconciled_at: now, updated_at: now }).eq("id", bundleId);
  if (kind === "refund" || kind === "cancel") await admin.from("pactset_go_bookings").update({ consent_status: "expired" }).eq("bundle_id", bundleId);
}

async function reconcileOne(admin: ReturnType<typeof createClient>, tx: Record<string, unknown>) {
  if (tx.status !== "pending" || !tx.tx_hash) return tx;
  try {
    const record = await soroban.getTransaction(String(tx.tx_hash));
    if (record.status === "SUCCESS") {
      const metadata = (tx.action_metadata ?? {}) as Record<string, unknown>;
      if (tx.kind === "contract_deploy") await soroban.getContractInstance(String(metadata.contractAddress));
      await applyConfirmation(admin, tx, "ledger" in record ? Number(record.ledger) : null);
    }
    if (record.status === "FAILED") await admin.from("pactset_go_transactions").update({ status: "failed", error_code: "ledger_failed", updated_at: new Date().toISOString() }).eq("id", tx.id);
  } catch (error) {
    if (!/not found/i.test(error instanceof Error ? error.message : "")) throw error;
  }
  const { data } = await admin.from("pactset_go_transactions").select("*").eq("id", tx.id).single(); return data;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization"); if (!authorization?.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
    const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return reply({ error: "Server configuration unavailable" }, 503);
    const auth = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } }); const { data: authData } = await auth.auth.getUser(); if (!authData.user) return reply({ error: "Authentication required" }, 401);
    const userId = authData.user.id; const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await request.json() as Record<string, unknown>; const action = String(body.action ?? "");
    if (action === "capabilities") {
      const { data: runtime } = await admin.from("pactset_go_runtime_registry").select("network,contract_version,wasm_hash,max_bookings").eq("network", "TESTNET").eq("active", true).maybeSingle();
      return reply({ available: Boolean(runtime), runtime });
    }
    if (action === "reconcile") { await admin.from("pactset_go_transactions").update({ status: "expired", error_code: "prepared_transaction_expired", updated_at: new Date().toISOString() }).eq("initiated_by", userId).eq("status", "prepared").lt("prepared_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()); const { data } = await admin.from("pactset_go_transactions").select("*").eq("initiated_by", userId).eq("status", "pending").limit(50); const reconciled = []; for (const tx of data ?? []) reconciled.push(await reconcileOne(admin, tx)); return reply({ reconciled }); }

    let bundleId = String(body.bundleId ?? "");
    if (action === "create") {
      const idempotencyKey = String(body.idempotencyKey ?? ""); if (!/^[a-z0-9_-]{16,160}$/i.test(idempotencyKey)) fail("A valid idempotency key is required");
      const { data: existing } = await admin.from("pactset_go_transactions").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing) { if (existing.initiated_by !== userId) fail("Idempotency key conflict", 409); return reply({ bundleId: existing.bundle_id, transaction: existing, xdr: existing.submitted_xdr, details: existing.action_metadata }); }
      const eventId = String(body.eventId ?? ""); const agreementIds = Array.isArray(body.agreementIds) ? body.agreementIds.map(String) : []; const deadline = new Date(String(body.activationDeadline ?? ""));
      if (agreementIds.length < 2 || agreementIds.length > 8 || Number.isNaN(deadline.getTime()) || deadline <= new Date()) fail("Choose 2–8 essential bookings and a future activation deadline");
      const { data: event } = await admin.from("events").select("id,organizer_id").eq("id", eventId).eq("organizer_id", userId).maybeSingle(); if (!event) fail("Event not found", 404, "not_found");
      const { data: agreements } = await admin.from("agreements").select("id,request_id,offer_version,organizer_id,provider_id,amount,currency,requests!inner(event_id),agreement_escrows!inner(id,contract_address,agreement_version,asset_id,payer_public_key,payee_public_key,total_amount,status,test_asset_registry!inner(stellar_asset_contract,asset_code))").in("id", agreementIds).eq("requests.event_id", eventId);
      if (!agreements || agreements.length !== agreementIds.length) fail("Every selected booking must belong to this event and have an escrow", 409, "ineligible_booking");
      const normalized = agreements.map((agreement) => { const escrow = Array.isArray(agreement.agreement_escrows) ? agreement.agreement_escrows[0] : agreement.agreement_escrows; return { agreement, escrow }; });
      const first = normalized[0]; if (!first?.escrow) fail("Escrow unavailable", 409); const assetId = String(first.escrow.asset_id);
      for (const item of normalized) if (item.agreement.organizer_id !== userId || item.escrow.status !== "awaiting_funding" || String(item.escrow.asset_id) !== assetId || item.escrow.agreement_version !== item.agreement.offer_version || units(item.agreement.amount) !== BigInt(item.escrow.total_amount)) fail("Selected bookings must be unfunded, current, and use one exact asset", 409, "ineligible_booking");
      const { data: runtime } = await admin.from("pactset_go_runtime_registry").select("*").eq("network", "TESTNET").eq("active", true).maybeSingle(); if (!runtime) fail("Pactset Go Testnet runtime is not registered", 409, "runtime_unavailable");
      const { data: organizerWallet } = await admin.from("wallet_connections").select("public_key").eq("user_id", userId).eq("network", "TESTNET").eq("active", true).maybeSingle(); if (!organizerWallet) fail("Verify the organizer Testnet wallet first", 409, "wallet_required");
      const providerIds = normalized.map((item) => item.agreement.provider_id); const { data: providerWallets } = await admin.from("wallet_connections").select("user_id,public_key").in("user_id", providerIds).eq("network", "TESTNET").eq("active", true); if ((providerWallets ?? []).length !== providerIds.length) fail("Every provider must verify a Testnet wallet first", 409, "provider_wallet_required");
      bundleId = crypto.randomUUID(); const hashes = await Promise.all(normalized.map((item) => sha256(String(item.agreement.id)))); const total = normalized.reduce((sum, item) => sum + BigInt(item.escrow.total_amount), 0n);
      const canonical = JSON.stringify({ bundleId, eventId, assetId, deadline: deadline.toISOString(), bookings: normalized.map((item, index) => ({ id: item.agreement.id, version: item.agreement.offer_version, hash: hex(hashes[index]), escrow: item.escrow.contract_address, provider: item.agreement.provider_id, amount: String(item.escrow.total_amount) })) }); const bundleHashBytes = await sha256(canonical); const bundleHash = hex(bundleHashBytes);
      const walletByUser = new Map((providerWallets ?? []).map((item) => [item.user_id, item.public_key]));
      const { error: registrationError } = await admin.rpc("register_pactset_go_bundle", { p_bundle_id: bundleId, p_event_id: eventId, p_organizer_id: userId, p_asset_id: assetId, p_bundle_hash: bundleHash, p_contract_version: runtime.contract_version, p_activation_deadline: deadline.toISOString(), p_total_amount: total.toString(), p_agreement_ids: normalized.map((item) => item.agreement.id), p_agreement_versions: normalized.map((item) => item.agreement.offer_version), p_agreement_hashes: hashes.map(hex), p_escrow_ids: normalized.map((item) => item.escrow.id), p_escrow_addresses: normalized.map((item) => item.escrow.contract_address), p_provider_ids: providerIds, p_provider_public_keys: providerIds.map((id) => walletByUser.get(id)), p_amounts: normalized.map((item) => String(item.escrow.total_amount)) }); if (registrationError) fail("Bundle registration failed", 409, "bundle_conflict");
      const { data: bookings } = await admin.from("pactset_go_bookings").select("*").eq("bundle_id", bundleId).order("id"); const salt = await sha256(`pactset-go:${bundleId}:1`); const address = contractId(organizerWallet.public_key, salt); const assetRecord = Array.isArray(first.escrow.test_asset_registry) ? first.escrow.test_asset_registry[0] : first.escrow.test_asset_registry; if (!assetRecord?.stellar_asset_contract) fail("The selected asset is not provisioned for Soroban", 409, "asset_unavailable"); const assetContract = String(assetRecord.stellar_asset_contract);
      const args = [xdr.ScVal.scvBytes(bundleHashBytes), nativeToScVal(organizerWallet.public_key, { type: "address" }), nativeToScVal(assetContract, { type: "address" }), nativeToScVal(BigInt(Math.floor(deadline.getTime() / 1000)), { type: "u64" }), xdr.ScVal.scvVec((bookings ?? []).map(bookingVal))];
      const account = await soroban.getAccount(organizerWallet.public_key); const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(Operation.createCustomContract({ address: new Address(organizerWallet.public_key), wasmHash: Buffer.from(runtime.wasm_hash, "hex"), salt, constructorArgs: args })).setTimeout(180).build(); let prepared; try { prepared = await soroban.prepareTransaction(raw); } catch { await admin.from("pactset_go_bundles").update({status:"failed"}).eq("id",bundleId); await admin.from("pactset_go_bookings").update({consent_status:"expired"}).eq("bundle_id",bundleId); fail("The Testnet bundle deployment could not be prepared",409,"contract_prepare_failed"); }
      const metadata = { action: "create", network: "Stellar Testnet", bundleId, contractAddress: address, assetCode: assetRecord.asset_code, totalAmount: total.toString(), bookingCount: bookings?.length, activationDeadline: deadline.toISOString(), guarantee: "All listed escrows fund in one Soroban invocation or none do." };
      const { data: transaction, error } = await admin.from("pactset_go_transactions").insert({ bundle_id: bundleId, initiated_by: userId, actor_public_key: organizerWallet.public_key, kind: "contract_deploy", idempotency_key: idempotencyKey, submitted_xdr: prepared.toXDR(), action_metadata: metadata }).select("*").single(); if (error) { await admin.from("pactset_go_bundles").update({status:"failed"}).eq("id",bundleId); await admin.from("pactset_go_bookings").update({consent_status:"expired"}).eq("bundle_id",bundleId); fail("Could not save prepared bundle deployment", 500); }
      return reply({ bundleId, transaction, xdr: prepared.toXDR(), details: metadata });
    }

    const { data: bundle } = await admin.from("pactset_go_bundles").select("*").eq("id", bundleId).maybeSingle(); if (!bundle) fail("Bundle not found", 404, "not_found");
    const { data: bookings } = await admin.from("pactset_go_bookings").select("*").eq("bundle_id", bundleId).order("id"); const participant = bundle.organizer_id === userId || (bookings ?? []).some((item) => item.provider_id === userId); if (!participant) fail("Bundle not found", 404, "not_found");
    if (action === "prepare") {
      if (!bundle.contract_address) fail("Bundle contract deployment is not confirmed", 409, "contract_unavailable"); const txAction = String(body.transactionAction ?? ""); const bookingId = String(body.bookingId ?? ""); const booking = (bookings ?? []).find((item) => item.id === bookingId); const organizerOnly = new Set(["reserve","activate","refund","cancel"]);
      if (organizerOnly.has(txAction) && bundle.organizer_id !== userId) fail("Only the organizer may authorize this bundle action", 403, "unauthorized"); if (["consent","revoke"].includes(txAction) && (!booking || booking.provider_id !== userId)) fail("Only the exact affected provider may authorize this consent", 403, "unauthorized"); if (txAction === "expire" && !participant) fail("Bundle not found", 404);
      const { data: wallet } = await admin.from("wallet_connections").select("public_key").eq("user_id", userId).eq("network", "TESTNET").eq("active", true).maybeSingle(); if (!wallet) fail("Verify a Stellar Testnet wallet first", 409, "wallet_required"); if (booking && booking.provider_public_key !== wallet.public_key) fail("The active wallet is not the wallet bound to this consent", 403, "wallet_mismatch");
      const method = ({ consent:"consent", revoke:"revoke", reserve:"reserve", activate:"activate", expire:"expire", refund:"refund", cancel:"cancel" } as Record<string,string>)[txAction]; if (!method) fail("Unsupported bundle action"); const args = booking ? [nativeToScVal((bookings ?? []).findIndex((item) => item.id === booking.id), { type: "u32" })] : [];
      const account = await soroban.getAccount(wallet.public_key); const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(new Contract(bundle.contract_address).call(method, ...args)).setTimeout(180).build(); let prepared; try { prepared = await soroban.prepareTransaction(raw); } catch { fail("The bundle contract rejected this action in its current state", 409, "invalid_contract_state"); }
      const idempotencyKey = String(body.idempotencyKey ?? ""); if (!/^[a-z0-9_-]{16,160}$/i.test(idempotencyKey)) fail("A valid idempotency key is required"); const { data: existing } = await admin.from("pactset_go_transactions").select("*").eq("idempotency_key", idempotencyKey).maybeSingle(); if (existing) return reply({ transaction: existing, xdr: existing.submitted_xdr, details: existing.action_metadata });
      const metadata = { action: txAction, network: "Stellar Testnet", bundleId, contractAddress: bundle.contract_address, totalAmount: bundle.total_amount, activationDeadline: bundle.activation_deadline, targetStatus: txAction === "expire" ? (bundle.status === "ready_to_activate" ? "refundable" : "expired") : undefined };
      const { data: transaction, error } = await admin.from("pactset_go_transactions").insert({ bundle_id: bundleId, booking_id: booking?.id ?? null, initiated_by: userId, actor_public_key: wallet.public_key, kind: txAction, idempotency_key: idempotencyKey, submitted_xdr: prepared.toXDR(), action_metadata: metadata }).select("*").single(); if (error) fail("Could not save prepared bundle transaction", 500); return reply({ transaction, xdr: prepared.toXDR(), details: metadata });
    }
    if (action === "submit") { const { data: tx } = await admin.from("pactset_go_transactions").select("*").eq("id", String(body.transactionId ?? "")).eq("bundle_id", bundleId).eq("initiated_by", userId).maybeSingle(); if (!tx) fail("Prepared transaction not found", 404); if (tx.status === "confirmed" || tx.status === "pending") return reply({ transaction: await reconcileOne(admin, tx) }); if (tx.status !== "prepared" || !tx.submitted_xdr) fail("This transaction cannot be submitted again", 409, "duplicate_submission"); const signedXdr = String(body.signedXdr ?? ""); const unsigned = TransactionBuilder.fromXDR(tx.submitted_xdr, Networks.TESTNET); const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET); if (!("signatureBase" in unsigned) || !("signatureBase" in signed) || Buffer.from(unsigned.signatureBase()).toString("hex") !== Buffer.from(signed.signatureBase()).toString("hex") || signed.signatures.length === 0) fail("The signed envelope does not match the reviewed bundle transaction", 400, "signature_mismatch"); const txHash = Buffer.from(signed.hash()).toString("hex"); const now = new Date().toISOString(); const { data: pending } = await admin.from("pactset_go_transactions").update({ status:"pending",tx_hash:txHash,submitted_xdr:signedXdr,submitted_at:now,updated_at:now }).eq("id",tx.id).eq("status","prepared").select("*").maybeSingle(); if (!pending) return reply({ transaction: tx }); try { const sent = await soroban.sendTransaction(signed as never); if (sent.status === "ERROR") throw new Error("ledger_rejected"); } catch { await admin.from("pactset_go_transactions").update({ status:"failed",error_code:"ledger_rejected",updated_at:now }).eq("id",tx.id); fail("Stellar RPC rejected the bundle transaction",422,"ledger_rejected"); } return reply({ transaction: await reconcileOne(admin,pending), explorerUrl:`https://stellar.expert/explorer/testnet/tx/${txHash}` }); }
    return reply({ error: "Unsupported action" }, 400);
  } catch (error) { const status = typeof (error as {status?:unknown}).status === "number" ? (error as {status:number}).status : 500; const code = typeof (error as {code?:unknown}).code === "string" ? (error as {code:string}).code : "server_error"; return reply({ error:error instanceof Error ? error.message : "Unexpected Pactset Go error", code }, status); }
});
