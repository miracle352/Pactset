import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org";
const horizon = new Horizon.Server(HORIZON_URL);
const soroban = new rpc.Server(RPC_URL);
const QUOTE_LIFETIME_MS = 2 * 60 * 1000;
const SLIPPAGE_BPS = 50n;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(message: string, status = 400, code = "invalid_request"): never {
  throw Object.assign(new Error(message), { status, code });
}

function decimalToUnits(value: string) {
  if (!/^\d+(\.\d{1,7})?$/.test(value)) fail("Invalid Stellar amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
}

function unitsToDecimal(value: bigint) {
  const whole = value / 10_000_000n;
  const fraction = (value % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function contractIdFromAddressAndSalt(address: string, salt: Uint8Array) {
  const networkId = hash(new TextEncoder().encode(Networks.TESTNET));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(new xdr.HashIdPreimageContractId({
    networkId,
    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(new xdr.ContractIdPreimageFromAddress({
      address: new Address(address).toScAddress(),
      salt,
    })),
  }));
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

function milestonePlan(agreement: Record<string, unknown>) {
  const total = decimalToUnits(String(agreement.amount));
  const source = Array.isArray(agreement.milestones) && agreement.milestones.length ? agreement.milestones : ["Complete agreed work"];
  const labels = source.map((item, index) => typeof item === "string" ? item.slice(0, 160) : String((item as Record<string, unknown>).label ?? (item as Record<string, unknown>).title ?? `Milestone ${index + 1}`).slice(0, 160));
  const specified = source.map((item) => typeof item === "object" && item && "amount" in item ? decimalToUnits(String((item as Record<string, unknown>).amount)) : null);
  if (specified.every((item) => item !== null) && specified.reduce((sum, item) => sum + (item ?? 0n), 0n) === total) return { labels, amounts: specified as bigint[], total };
  const each = total / BigInt(labels.length);
  const amounts = labels.map((_, index) => index === 0 ? each + (total % BigInt(labels.length)) : each);
  return { labels, amounts, total };
}

function assetFromPath(value: Record<string, string>) {
  return value.asset_type === "native" ? Asset.native() : new Asset(value.asset_code, value.asset_issuer);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Transaction request failed";
  if (/underfunded|insufficient|reserve/i.test(message)) return { message: "The wallet has insufficient XLM or reserve for this action.", code: "insufficient_balance" };
  if (/no trust|trustline/i.test(message)) return { message: "Add the agreement asset trustline before converting or receiving funds.", code: "missing_trustline" };
  if (/too few offers|no path|liquidity/i.test(message)) return { message: "Conversion liquidity is unavailable for this exact Testnet asset.", code: "liquidity_unavailable" };
  return { message, code: "transaction_failed" };
}

async function context(admin: ReturnType<typeof createClient>, userId: string, agreementId: string, walletRequired = true) {
  const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
  const support = await isSupport(admin, userId);
  if (!agreement) fail("Agreement not found", 404, "not_found");
  const assignedSupport = support && await isAssignedSupport(admin, userId, agreementId);
  if (agreement.organizer_id !== userId && agreement.provider_id !== userId && !assignedSupport) fail("Agreement not found", 404, "not_found");
  const [{ data: escrow }, { data: wallet }] = await Promise.all([
    admin.from("agreement_escrows").select("*").eq("agreement_id", agreementId).maybeSingle(),
    admin.from("wallet_connections").select("public_key,network").eq("user_id", userId).eq("network", "TESTNET").eq("active", true).maybeSingle(),
  ]);
  if (!escrow) fail("Escrow has not been prepared for this agreement", 409, "escrow_unavailable");
  if (walletRequired && !wallet) fail("Verify a Stellar Testnet wallet first", 409, "wallet_required");
  if (agreement.organizer_id !== userId && agreement.provider_id !== userId && !(assignedSupport && (!walletRequired || wallet?.public_key === escrow.resolver_public_key))) fail("Agreement not found", 404, "not_found");
  const { data: asset } = await admin.from("test_asset_registry").select("*").eq("id", escrow.asset_id).single();
  if (!asset) fail("Agreement asset is not registered", 409, "asset_unavailable");
  return { agreement, escrow, wallet, asset };
}

function requireWallet(expected: string, actual: string) {
  if (expected !== actual) fail("The connected wallet is not the wallet bound to this escrow role", 403, "wallet_mismatch");
}

async function isSupport(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin.from("account_roles").select("role,status").eq("user_id", userId).eq("role", "support").eq("status", "active").maybeSingle();
  return Boolean(data);
}

async function isAssignedSupport(admin: ReturnType<typeof createClient>, userId: string, agreementId: string) {
  const { data } = await admin.from("support_cases").select("id").eq("agreement_id", agreementId).eq("assigned_support_id", userId).in("status", ["assigned", "under_review"]).limit(1).maybeSingle();
  return Boolean(data);
}

async function applyConfirmation(admin: ReturnType<typeof createClient>, transaction: Record<string, unknown>, ledger: number | null) {
  const now = new Date().toISOString();
  const transactionId = String(transaction.id);
  const kind = String(transaction.kind);
  const escrowId = transaction.escrow_id ? String(transaction.escrow_id) : null;
  const milestoneId = transaction.milestone_id ? String(transaction.milestone_id) : null;
  const metadata = (transaction.action_metadata ?? {}) as Record<string, unknown>;
  if (kind === "contract_deploy") {
    const contractAddress = String(metadata.contractAddress ?? "");
    if (!/^C[A-Z2-7]{55}$/.test(contractAddress)) fail("Confirmed deployment did not return a valid contract address", 502, "deployment_result_invalid");
    const { data: deployed, error } = await admin.rpc("finalize_escrow_deployment", {
      p_agreement_id: transaction.agreement_id,
      p_contract_address: contractAddress,
      p_deployment_tx_hash: transaction.tx_hash,
      p_payer_public_key: metadata.payerPublicKey,
      p_payee_public_key: metadata.payeePublicKey,
      p_resolver_public_key: metadata.resolverPublicKey,
      p_agreement_hash: metadata.agreementHash,
      p_terms_hash: metadata.termsHash,
      p_asset_id: metadata.assetId,
      p_total_amount: metadata.totalAmount,
      p_milestone_labels: metadata.milestoneLabels,
      p_milestone_amounts: metadata.milestoneAmounts,
    });
    if (error || !deployed) fail("The confirmed escrow could not be reconciled", 502, "deployment_reconciliation_failed");
    await admin.from("payment_transactions").update({ escrow_id: deployed.id }).eq("id", transactionId);
  }
  await admin.from("payment_transactions").update({ status: "confirmed", ledger, confirmed_at: now, updated_at: now, error_code: null }).eq("id", transactionId).eq("status", "pending");
  if (kind === "conversion" && transaction.quote_id) await admin.from("payment_quotes").update({ consumed_at: now }).eq("id", transaction.quote_id);
  if (kind === "conversion" || kind === "trustline" || kind === "contract_deploy") return;
  if (!escrowId) return;
  if (kind === "funding") await admin.from("agreement_escrows").update({ status: "funded", funding_tx_hash: transaction.tx_hash, funded_at: now, last_reconciled_at: now, updated_at: now }).eq("id", escrowId);
  if (kind === "submission" && milestoneId) await admin.from("escrow_milestones").update({ status: "submitted", submitted_at: now, updated_at: now }).eq("id", milestoneId);
  if (kind === "correction" && milestoneId) {
    await admin.from("escrow_milestones").update({ status: "correction_requested", updated_at: now }).eq("id", milestoneId);
    await admin.from("milestone_evidence").update({ status: "correction_requested", organizer_feedback: String(metadata.feedback ?? "Corrections requested"), reviewed_by: transaction.initiated_by, reviewed_at: now, updated_at: now }).eq("milestone_id", milestoneId).eq("status", "submitted");
  }
  if ((kind === "release" || (kind === "resolution" && transaction.resolution === "release")) && milestoneId) {
    await admin.from("escrow_milestones").update({ status: "released", release_tx_hash: transaction.tx_hash, approved_at: now, released_at: now, updated_at: now }).eq("id", milestoneId);
    await admin.from("milestone_evidence").update({ status: "approved", reviewed_by: transaction.initiated_by, reviewed_at: now, updated_at: now }).eq("milestone_id", milestoneId).eq("status", "submitted");
  }
  if (kind === "dispute" && milestoneId) await admin.from("escrow_milestones").update({ status: "disputed", updated_at: now }).eq("id", milestoneId);
  if ((kind === "refund" || (kind === "resolution" && transaction.resolution === "refund")) && milestoneId) await admin.from("escrow_milestones").update({ status: "refunded", refund_tx_hash: transaction.tx_hash, updated_at: now }).eq("id", milestoneId);
  if (kind === "resolution") {
    const decision = transaction.resolution === "release" ? "release" : "refund";
    const { data: supportCase } = await admin.from("support_cases").select("id").eq("agreement_id", transaction.agreement_id).eq("assigned_support_id", transaction.initiated_by).in("status", ["assigned", "under_review"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (supportCase) {
      const reason = String(metadata.decisionReason ?? "").slice(0, 4000);
      await admin.from("support_cases").update({ status: "resolved", decision, decision_reason: reason, resolved_at: now, updated_at: now }).eq("id", supportCase.id);
      await admin.from("support_case_events").insert({ case_id: supportCase.id, actor_id: transaction.initiated_by, action: `resolved_${decision}`, reason, details: { transaction_hash: transaction.tx_hash, milestone_id: milestoneId } });
    }
  }
  const { data: milestones } = await admin.from("escrow_milestones").select("status").eq("escrow_id", escrowId);
  const states = (milestones ?? []).map((item) => item.status);
  let escrowStatus = states.includes("disputed") ? "disputed" : states.every((item) => item === "released") ? "completed" : states.every((item) => item === "refunded") ? "refunded" : states.includes("released") ? "partially_released" : states.includes("refunded") ? "partially_refunded" : "funded";
  await admin.from("agreement_escrows").update({ status: escrowStatus, last_reconciled_at: now, updated_at: now }).eq("id", escrowId);
}

async function reconcileOne(admin: ReturnType<typeof createClient>, transaction: Record<string, unknown>) {
  if (!transaction.tx_hash || transaction.status !== "pending") return transaction;
  try {
    if (transaction.kind === "trustline" || transaction.kind === "conversion") {
      const record = await horizon.transactions().transaction(String(transaction.tx_hash)).call();
      if (record.successful) await applyConfirmation(admin, transaction, Number(record.ledger_attr));
      else await admin.from("payment_transactions").update({ status: "failed", error_code: "ledger_failed", updated_at: new Date().toISOString() }).eq("id", transaction.id);
    } else {
      const record = await soroban.getTransaction(String(transaction.tx_hash));
      if (record.status === "SUCCESS") {
        if (transaction.kind === "contract_deploy") {
          const deploymentMetadata = (transaction.action_metadata ?? {}) as Record<string, unknown>;
          let address = String(deploymentMetadata.contractAddress ?? "");
          if (!address && deploymentMetadata.payerPublicKey && deploymentMetadata.agreementVersion) {
            const salt = await sha256(`pactset:${transaction.agreement_id}:${deploymentMetadata.agreementVersion}`);
            address = contractIdFromAddressAndSalt(String(deploymentMetadata.payerPublicKey), salt);
            transaction.action_metadata = { ...deploymentMetadata, contractAddress: address };
            await admin.from("payment_transactions").update({ action_metadata: transaction.action_metadata }).eq("id", transaction.id);
          }
          if (!/^C[A-Z2-7]{55}$/.test(address)) fail("Prepared deployment is missing its deterministic contract address", 502, "deployment_result_invalid");
          await soroban.getContractInstance(address);
        }
        await applyConfirmation(admin, transaction, "ledger" in record ? Number(record.ledger) : null);
      }
      if (record.status === "FAILED") await admin.from("payment_transactions").update({ status: "failed", error_code: "ledger_failed", updated_at: new Date().toISOString() }).eq("id", transaction.id);
    }
  } catch (error) {
    if (!/not found/i.test(error instanceof Error ? error.message : "")) throw error;
  }
  const { data } = await admin.from("payment_transactions").select("*").eq("id", transaction.id).single();
  return data;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return reply({ error: "Server configuration unavailable" }, 503);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Authentication required" }, 401);
    const userId = authData.user.id;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "reconcile") {
      await admin.from("payment_transactions").update({ status: "expired", error_code: "prepared_transaction_expired", updated_at: new Date().toISOString() }).eq("status", "prepared").eq("initiated_by", userId).lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      const query = admin.from("payment_transactions").select("*").eq("status", "pending").eq("initiated_by", userId).order("created_at").limit(100);
      const { data } = await query;
      const reconciled = [];
      for (const transaction of data ?? []) reconciled.push(await reconcileOne(admin, transaction));
      return reply({ reconciled });
    }

    const agreementId = String(body.agreementId ?? "");
    if (action === "prepare" && String(body.transactionAction ?? "") === "create_escrow") {
      const idempotencyKey = String(body.idempotencyKey ?? "");
      if (!/^[a-z0-9_-]{16,160}$/i.test(idempotencyKey)) fail("A valid idempotency key is required");
      const { data: existing } = await admin.from("payment_transactions").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing) {
        if (existing.initiated_by !== userId || existing.agreement_id !== agreementId) fail("Idempotency key conflict", 409);
        return reply({ transaction: existing, xdr: existing.submitted_xdr, details: existing.action_metadata });
      }
      const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
      if (!agreement || agreement.organizer_id !== userId) fail("Agreement not found", 404, "not_found");
      const { data: currentEscrow } = await admin.from("agreement_escrows").select("id,contract_address").eq("agreement_id", agreementId).maybeSingle();
      if (currentEscrow) return reply({ alreadyCreated: true, escrow: currentEscrow });
      const [{ data: payerWallet }, { data: payeeWallet }, { data: runtime }, { data: asset }] = await Promise.all([
        admin.from("wallet_connections").select("public_key").eq("user_id", agreement.organizer_id).eq("network", "TESTNET").eq("active", true).maybeSingle(),
        admin.from("wallet_connections").select("public_key").eq("user_id", agreement.provider_id).eq("network", "TESTNET").eq("active", true).maybeSingle(),
        admin.from("escrow_runtime_registry").select("*").eq("network", "TESTNET").eq("active", true).maybeSingle(),
        admin.from("test_asset_registry").select("*").eq("asset_code", agreement.currency).maybeSingle(),
      ]);
      if (!payerWallet) fail("Verify the organizer Testnet wallet first", 409, "payer_wallet_required");
      if (!payeeWallet) fail("The provider must verify a distinct Testnet wallet before escrow creation", 409, "payee_wallet_required");
      if (payerWallet.public_key === payeeWallet.public_key) fail("Organizer and provider must use distinct wallets", 409, "wallet_reuse");
      if (!runtime?.active || !runtime.wasm_hash) fail("The Testnet escrow runtime is not ready", 409, "runtime_unavailable");
      const [{ data: resolverWallet }, { data: resolverRole }] = await Promise.all([
        admin.from("wallet_connections").select("public_key").eq("user_id", runtime.resolver_user_id).eq("network", "TESTNET").eq("public_key", runtime.resolver_public_key).eq("active", true).maybeSingle(),
        admin.from("account_roles").select("role").eq("user_id", runtime.resolver_user_id).eq("role", "support").eq("status", "active").maybeSingle(),
      ]);
      if (!resolverWallet || !resolverRole) fail("The disclosed Testnet resolver is not available", 409, "resolver_unavailable");
      if (!asset || asset.provisioning_status !== "ready" || !asset.stellar_asset_contract) fail("This exact agreement asset requires Testnet setup", 409, "asset_unavailable");
      const plan = milestonePlan(agreement);
      const agreementHashBytes = await sha256(agreementId);
      const termsRecord = {
        agreementId,
        version: agreement.offer_version,
        scope: agreement.scope,
        currency: agreement.currency,
        totalAmount: plan.total.toString(),
        milestoneLabels: plan.labels,
        milestoneAmounts: plan.amounts.map(String),
        cancellationTerms: agreement.cancellation_terms,
        payer: payerWallet.public_key,
        payee: payeeWallet.public_key,
        resolver: runtime.resolver_public_key,
        asset: asset.stellar_asset_contract,
      };
      const termsHashBytes = await sha256(JSON.stringify(termsRecord));
      const salt = await sha256(`pactset:${agreementId}:${agreement.offer_version}`);
      const contractAddress = contractIdFromAddressAndSalt(payerWallet.public_key, salt);
      const constructorArgs = [
        xdr.ScVal.scvBytes(agreementHashBytes),
        nativeToScVal(agreement.offer_version, { type: "u32" }),
        nativeToScVal(payerWallet.public_key, { type: "address" }),
        nativeToScVal(payeeWallet.public_key, { type: "address" }),
        nativeToScVal(runtime.resolver_public_key, { type: "address" }),
        nativeToScVal(asset.stellar_asset_contract, { type: "address" }),
        xdr.ScVal.scvVec(plan.amounts.map((amount) => nativeToScVal(amount, { type: "i128" }))),
        xdr.ScVal.scvBytes(termsHashBytes),
      ];
      const account = await soroban.getAccount(payerWallet.public_key);
      const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.createCustomContract({ address: new Address(payerWallet.public_key), wasmHash: Buffer.from(runtime.wasm_hash, "hex"), salt, constructorArgs }))
        .setTimeout(180).build();
      const prepared = await soroban.prepareTransaction(raw);
      const metadata = {
        network: "Stellar Testnet", action: "create_escrow", agreementId,
        agreementVersion: agreement.offer_version, agreementHash: hex(agreementHashBytes), termsHash: hex(termsHashBytes),
        payerPublicKey: payerWallet.public_key, payeePublicKey: payeeWallet.public_key,
        resolverPublicKey: runtime.resolver_public_key, assetId: asset.id, assetCode: asset.asset_code,
        assetContract: asset.stellar_asset_contract, contractAddress, totalAmount: plan.total.toString(),
        milestoneLabels: plan.labels, milestoneAmounts: plan.amounts.map(String),
        resolverRule: "Only the assigned support account owning this disclosed resolver wallet may resolve a disputed, unreleased milestone.",
      };
      const xdrText = prepared.toXDR();
      const { data: transaction, error } = await admin.from("payment_transactions").insert({
        agreement_id: agreementId, initiated_by: userId, actor_public_key: payerWallet.public_key,
        kind: "contract_deploy", idempotency_key: idempotencyKey, submitted_xdr: xdrText,
        status: "prepared", action_name: "create_escrow", action_metadata: metadata, prepared_at: new Date().toISOString(),
      }).select("*").single();
      if (error || !transaction) fail("Could not save the prepared escrow deployment", 500);
      return reply({ transaction, xdr: xdrText, details: metadata });
    }
    if (action === "submit") {
      const transactionId = String(body.transactionId ?? "");
      const { data: deployment } = await admin.from("payment_transactions").select("*").eq("id", transactionId).eq("agreement_id", agreementId).eq("initiated_by", userId).eq("kind", "contract_deploy").maybeSingle();
      if (deployment) {
        if (deployment.status === "confirmed" || deployment.status === "pending") return reply({ transaction: await reconcileOne(admin, deployment) });
        if (deployment.status !== "prepared" || !deployment.submitted_xdr) fail("This deployment cannot be submitted again", 409, "duplicate_submission");
        const signedXdr = String(body.signedXdr ?? "");
        const unsigned = TransactionBuilder.fromXDR(deployment.submitted_xdr, Networks.TESTNET);
        const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
        if (!("signatureBase" in unsigned) || !("signatureBase" in signed) || Buffer.from(unsigned.signatureBase()).toString("hex") !== Buffer.from(signed.signatureBase()).toString("hex") || signed.signatures.length === 0) fail("The signed envelope does not match the reviewed deployment", 400, "signature_mismatch");
        const hash = Buffer.from(signed.hash()).toString("hex");
        const now = new Date().toISOString();
        const { data: pending } = await admin.from("payment_transactions").update({ status: "pending", tx_hash: hash, submitted_xdr: signedXdr, submitted_at: now, updated_at: now }).eq("id", deployment.id).eq("status", "prepared").select("*").maybeSingle();
        if (!pending) {
          const { data: current } = await admin.from("payment_transactions").select("*").eq("id", deployment.id).single();
          return reply({ transaction: current });
        }
        try {
          const result = await soroban.sendTransaction(signed as never);
          if (result.status === "ERROR") fail("Stellar RPC rejected the escrow deployment", 422, "ledger_rejected");
        } catch (error) {
          const detail = safeError(error);
          await admin.from("payment_transactions").update({ status: "failed", error_code: detail.code, updated_at: new Date().toISOString() }).eq("id", pending.id);
          return reply({ error: detail.message, code: detail.code, txHash: hash }, 422);
        }
        return reply({ transaction: await reconcileOne(admin, pending), explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}` });
      }
    }
    const ctx = await context(admin, userId, agreementId, !["recordEvidence", "evidenceUrl"].includes(action));

    if (action === "quote") {
      if (ctx.agreement.organizer_id !== userId) fail("Only the organizer can request a conversion quote", 403, "unauthorized");
      requireWallet(ctx.escrow.payer_public_key, ctx.wallet.public_key);
      if (ctx.asset.provisioning_status !== "ready" || ctx.asset.liquidity_status !== "ready" || !ctx.asset.issuer_public_key) fail("Conversion is unavailable until this exact test asset is provisioned and seeded", 409, "liquidity_unavailable");
      const destination = unitsToDecimal(BigInt(ctx.escrow.total_amount));
      const destinationAsset = new Asset(ctx.asset.asset_code, ctx.asset.issuer_public_key);
      const account = await horizon.loadAccount(ctx.wallet.public_key);
      const trustline = account.balances.find((item) => "asset_code" in item && item.asset_code === ctx.asset.asset_code && item.asset_issuer === ctx.asset.issuer_public_key);
      if (!trustline) return reply({ requiresTrustline: true, asset: { code: ctx.asset.asset_code, issuer: ctx.asset.issuer_public_key }, reserveNotice: "A Stellar trustline increases the wallet's minimum XLM reserve." }, 409);
      const paths = await horizon.strictReceivePaths([Asset.native()], destinationAsset, destination).call();
      const path = paths.records.find((record) => record.source_asset_type === "native");
      if (!path) fail("No XLM conversion path is available for this exact Testnet asset", 409, "liquidity_unavailable");
      const expected = decimalToUnits(path.source_amount);
      const sendMax = (expected * (10_000n + SLIPPAGE_BPS) + 9_999n) / 10_000n;
      const expiresAt = new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString();
      const { data: quote, error } = await admin.from("payment_quotes").insert({
        agreement_id: agreementId, requested_by: userId, network: "TESTNET", output_asset_id: ctx.asset.id,
        send_max_stroops: sendMax.toString(), destination_amount: ctx.escrow.total_amount,
        expected_send_amount: expected.toString(), fee_stroops: Number(BASE_FEE), slippage_bps: Number(SLIPPAGE_BPS),
        path: path.path, expires_at: expiresAt,
      }).select("*").single();
      if (error || !quote) fail("Could not save the conversion quote", 500);
      return reply({ quote: { id: quote.id, inputAsset: "XLM", outputAsset: `${ctx.asset.asset_code}:${ctx.asset.issuer_public_key}`, expectedInput: unitsToDecimal(expected), maximumInput: unitsToDecimal(sendMax), exactOutput: destination, feeStroops: Number(BASE_FEE), slippageBps: Number(SLIPPAGE_BPS), expiresAt, rateSource: quote.rate_source } });
    }

    if (action === "recordEvidence") {
      if (ctx.agreement.provider_id !== userId) fail("Only the provider can submit evidence", 403, "unauthorized");
      const milestoneId = String(body.milestoneId ?? "");
      const note = String(body.note ?? "").trim();
      const objectPath = body.objectPath ? String(body.objectPath) : null;
      const mediaType = body.mediaType ? String(body.mediaType) : null;
      const sizeBytes = body.sizeBytes ? Number(body.sizeBytes) : null;
      const { data: milestone } = await admin.from("escrow_milestones").select("id,status").eq("id", milestoneId).eq("escrow_id", ctx.escrow.id).maybeSingle();
      if (!milestone || !["pending", "correction_requested"].includes(milestone.status)) fail("This milestone cannot accept new evidence", 409);
      if (!note || note.length > 4000) fail("Evidence note must be between 1 and 4,000 characters");
      if (objectPath && (!objectPath.startsWith(`${agreementId}/${milestoneId}/`) || !mediaType || !ALLOWED_MEDIA.has(mediaType) || !sizeBytes || sizeBytes > 52_428_800)) fail("Invalid evidence upload metadata");
      const { data, error } = await admin.from("milestone_evidence").insert({ milestone_id: milestoneId, submitted_by: userId, note, object_path: objectPath, media_type: mediaType, size_bytes: sizeBytes }).select("*").single();
      if (error || !data) {
        if (objectPath) await admin.storage.from("milestone-evidence").remove([objectPath]);
        fail("Could not save evidence", 500);
      }
      return reply({ evidence: data });
    }

    if (action === "evidenceUrl") {
      const evidenceId = String(body.evidenceId ?? "");
      const { data: evidence } = await admin.from("milestone_evidence").select("id,object_path,milestone_id").eq("id", evidenceId).maybeSingle();
      if (!evidence?.object_path) fail("Evidence media is unavailable", 404);
      const { data: milestone } = await admin.from("escrow_milestones").select("id").eq("id", evidence.milestone_id).eq("escrow_id", ctx.escrow.id).maybeSingle();
      if (!milestone) fail("Evidence not found", 404);
      const { data, error } = await admin.storage.from("milestone-evidence").createSignedUrl(evidence.object_path, 60);
      if (error || !data) fail("Could not create a private evidence link", 500);
      return reply({ signedUrl: data.signedUrl, expiresIn: 60 });
    }

    if (action === "prepare") {
      const requestedAction = String(body.transactionAction ?? "");
      const milestoneIndex = body.milestoneIndex === undefined ? null : Number(body.milestoneIndex);
      const idempotencyKey = String(body.idempotencyKey ?? "");
      if (!/^[a-z0-9_-]{16,160}$/i.test(idempotencyKey)) fail("A valid idempotency key is required");
      const { data: existing } = await admin.from("payment_transactions").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing) {
        if (existing.initiated_by !== userId || existing.agreement_id !== agreementId) fail("Idempotency key conflict", 409);
        return reply({ transaction: existing, details: existing.action_metadata });
      }

      let tx;
      let kind = "";
      let milestoneId: string | null = null;
      let quoteId: string | null = null;
      let resolution: string | null = null;
      let metadata: Record<string, unknown> = { network: "Stellar Testnet", networkPassphrase: Networks.TESTNET };
      if (requestedAction === "change_trust") {
        const account = await horizon.loadAccount(ctx.wallet.public_key);
        const asset = new Asset(ctx.asset.asset_code, ctx.asset.issuer_public_key);
        tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addMemo(Memo.text(`Trust ${ctx.asset.asset_code}`)).addOperation(Operation.changeTrust({ asset })).setTimeout(180).build();
        kind = "trustline";
        metadata = { ...metadata, assetCode: ctx.asset.asset_code, issuer: ctx.asset.issuer_public_key, feeStroops: Number(BASE_FEE), reserveNotice: "This trustline increases the wallet's minimum XLM reserve." };
      } else if (requestedAction === "convert") {
        if (ctx.agreement.organizer_id !== userId) fail("Only the organizer can convert for this agreement", 403, "unauthorized");
        requireWallet(ctx.escrow.payer_public_key, ctx.wallet.public_key);
        quoteId = String(body.quoteId ?? "");
        const { data: quote } = await admin.from("payment_quotes").select("*").eq("id", quoteId).eq("agreement_id", agreementId).eq("requested_by", userId).maybeSingle();
        if (!quote || quote.consumed_at || Date.parse(quote.expires_at) <= Date.now()) fail("The conversion quote has expired. Request a fresh quote.", 410, "quote_expired");
        const account = await horizon.loadAccount(ctx.wallet.public_key);
        tx = new TransactionBuilder(account, { fee: String(quote.fee_stroops), networkPassphrase: Networks.TESTNET }).addMemo(Memo.text(`Pactset ${ctx.asset.asset_code}`)).addOperation(Operation.pathPaymentStrictReceive({ sendAsset: Asset.native(), sendMax: unitsToDecimal(BigInt(quote.send_max_stroops)), destination: ctx.wallet.public_key, destAsset: new Asset(ctx.asset.asset_code, ctx.asset.issuer_public_key), destAmount: unitsToDecimal(BigInt(quote.destination_amount)), path: (quote.path as Record<string, string>[]).map(assetFromPath) })).setTimeout(180).build();
        kind = "conversion";
        metadata = { ...metadata, inputAsset: "XLM", outputAsset: `${ctx.asset.asset_code}:${ctx.asset.issuer_public_key}`, expectedInput: unitsToDecimal(BigInt(quote.expected_send_amount)), maximumInput: unitsToDecimal(BigInt(quote.send_max_stroops)), exactOutput: unitsToDecimal(BigInt(quote.destination_amount)), feeStroops: quote.fee_stroops, slippageBps: quote.slippage_bps, quoteExpiresAt: quote.expires_at, rateSource: quote.rate_source };
      } else {
        const roleMap: Record<string, string> = { fund: "organizer", submit: "provider", request_correction: "organizer", approve_release: "organizer", dispute: "participant", resolve: "support" };
        if (!roleMap[requestedAction]) fail("Unsupported transaction action");
        if ((roleMap[requestedAction] === "organizer" && ctx.agreement.organizer_id !== userId) || (roleMap[requestedAction] === "provider" && ctx.agreement.provider_id !== userId)) fail("This account is not authorized for that action", 403, "unauthorized");
        if (roleMap[requestedAction] === "support" && !(await isSupport(admin, userId) && await isAssignedSupport(admin, userId, agreementId))) fail("Assigned support access is required", 403, "unauthorized");
        const expectedWallet = requestedAction === "resolve" ? ctx.escrow.resolver_public_key : ctx.agreement.organizer_id === userId ? ctx.escrow.payer_public_key : ctx.escrow.payee_public_key;
        requireWallet(expectedWallet, ctx.wallet.public_key);
        const contract = new Contract(ctx.escrow.contract_address);
        const args = [];
        if (requestedAction !== "fund") {
          if (!Number.isInteger(milestoneIndex) || Number(milestoneIndex) < 0) fail("A valid milestone is required");
          const { data: milestone } = await admin.from("escrow_milestones").select("id,status,amount,label").eq("escrow_id", ctx.escrow.id).eq("milestone_index", milestoneIndex).maybeSingle();
          if (!milestone) fail("Milestone not found", 404);
          milestoneId = milestone.id;
          if (requestedAction === "dispute") args.push(nativeToScVal(ctx.wallet.public_key, { type: "address" }));
          args.push(nativeToScVal(milestoneIndex, { type: "u32" }));
          metadata = { ...metadata, milestoneIndex, milestoneLabel: milestone.label, milestoneAmount: unitsToDecimal(BigInt(milestone.amount)), assetCode: ctx.asset.asset_code };
        }
        const contractMethod = requestedAction;
        if (requestedAction === "resolve") {
          resolution = String(body.resolution ?? "");
          if (!["release", "refund"].includes(resolution)) fail("Choose release or refund");
          if (String(body.feedback ?? "").trim().length < 3) fail("Record a decision reason before resolving the dispute");
          args.push(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(resolution === "release" ? "ReleaseToPayee" : "RefundToPayer")]));
        }
        if (requestedAction === "request_correction" && String(body.feedback ?? "").trim().length < 3) fail("Explain the required correction before signing");
        const account = await soroban.getAccount(ctx.wallet.public_key);
        const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(contract.call(contractMethod, ...args)).setTimeout(180).build();
        try {
          tx = await soroban.prepareTransaction(raw);
        } catch {
          fail("The escrow contract rejected this action in its current milestone state", 409, "invalid_contract_state");
        }
        kind = ({ fund: "funding", submit: "submission", request_correction: "correction", approve_release: "release", dispute: "dispute", resolve: "resolution" } as Record<string, string>)[requestedAction];
        metadata = { ...metadata, contractAddress: ctx.escrow.contract_address, action: requestedAction, agreementId, feedback: requestedAction === "request_correction" ? String(body.feedback ?? "").slice(0, 4000) : undefined, decisionReason: requestedAction === "resolve" ? String(body.feedback ?? "").trim().slice(0, 4000) : undefined };
      }
      const xdr = tx.toXDR();
      const { data: transaction, error } = await admin.from("payment_transactions").insert({ agreement_id: agreementId, escrow_id: ctx.escrow.id, milestone_id: milestoneId, initiated_by: userId, actor_public_key: ctx.wallet.public_key, kind, idempotency_key: idempotencyKey, submitted_xdr: xdr, status: "prepared", quote_id: quoteId, action_name: requestedAction, milestone_index: milestoneIndex, resolution, action_metadata: metadata, prepared_at: new Date().toISOString() }).select("*").single();
      if (error || !transaction) fail("Could not save the prepared transaction", 500);
      return reply({ transaction, xdr, details: metadata });
    }

    if (action === "submit") {
      const transactionId = String(body.transactionId ?? "");
      const signedXdr = String(body.signedXdr ?? "");
      const { data: transaction } = await admin.from("payment_transactions").select("*").eq("id", transactionId).eq("agreement_id", agreementId).eq("initiated_by", userId).maybeSingle();
      if (!transaction) fail("Prepared transaction not found", 404);
      if (transaction.status === "confirmed" || transaction.status === "pending") return reply({ transaction: await reconcileOne(admin, transaction) });
      if (transaction.status !== "prepared" || !transaction.submitted_xdr) fail("This transaction cannot be submitted again", 409, "duplicate_submission");
      const unsigned = TransactionBuilder.fromXDR(transaction.submitted_xdr, Networks.TESTNET);
      const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
      if (!("signatureBase" in unsigned) || !("signatureBase" in signed) || Buffer.from(unsigned.signatureBase()).toString("hex") !== Buffer.from(signed.signatureBase()).toString("hex") || signed.signatures.length === 0) fail("The signed envelope does not match the reviewed transaction", 400, "signature_mismatch");
      const hash = Buffer.from(signed.hash()).toString("hex");
      const now = new Date().toISOString();
      const { data: pending } = await admin.from("payment_transactions").update({ status: "pending", tx_hash: hash, submitted_xdr: signedXdr, submitted_at: now, updated_at: now }).eq("id", transaction.id).eq("status", "prepared").select("*").maybeSingle();
      if (!pending) {
        const { data: current } = await admin.from("payment_transactions").select("*").eq("id", transaction.id).single();
        return reply({ transaction: current });
      }
      try {
        if (pending.kind === "trustline" || pending.kind === "conversion") await horizon.submitTransaction(signed as never);
        else {
          const result = await soroban.sendTransaction(signed as never);
          if (result.status === "ERROR") fail("Stellar RPC rejected the transaction", 422, "ledger_rejected");
        }
      } catch (error) {
        const detail = safeError(error);
        await admin.from("payment_transactions").update({ status: "failed", error_code: detail.code, updated_at: new Date().toISOString() }).eq("id", pending.id);
        return reply({ error: detail.message, code: detail.code, txHash: hash }, 422);
      }
      return reply({ transaction: await reconcileOne(admin, pending), explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}` });
    }

    return reply({ error: "Unsupported action" }, 400);
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "server_error";
    return reply({ error: error instanceof Error ? error.message : "Unexpected payment error", code }, status);
  }
});
