import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Keypair, Networks, StrKey } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function failure(error: string, code: string, status: number) {
  return response({ error, code }, status);
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeSignature(value: unknown) {
  if (typeof value !== "string" || value.length > 512) throw new Error("Invalid signature encoding");
  if (/^[0-9a-f]{128}$/i.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (request.method !== "POST") return failure("Method not allowed", "method_not_allowed", 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return failure("Your Pactset session has expired. Sign in again before connecting a wallet.", "session_expired", 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRole) return failure("Wallet verification is temporarily unavailable.", "server_configuration", 503);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return failure("Your Pactset session has expired. Sign in again before connecting a wallet.", "session_expired", 401);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return failure("Invalid wallet request", "invalid_request", 400);
  }

  const action = body.action;
  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  if (!StrKey.isValidEd25519PublicKey(publicKey)) return failure("Invalid Stellar account", "invalid_wallet", 400);
  if (body.network !== "TESTNET") return failure("Pactset wallet verification requires Stellar Testnet", "wrong_network", 400);

  if (action === "disconnect") {
    const { error } = await admin.from("wallet_connections").update({ active: false, updated_at: new Date().toISOString() }).eq("user_id", authData.user.id).eq("public_key", publicKey).eq("network", "TESTNET").eq("active", true);
    if (error) return failure("Could not disconnect this wallet", "wallet_disconnect_failed", 500);
    return response({ disconnected: true });
  }

  if (action === "challenge") {
    // Avoid requesting a signature when the selected address cannot be bound to
    // this Pactset account. The response deliberately does not identify the
    // other account that owns the active connection.
    const { data: existingConnection, error: connectionLookupError } = await admin
      .from("wallet_connections")
      .select("user_id")
      .eq("public_key", publicKey)
      .eq("network", "TESTNET")
      .eq("active", true)
      .maybeSingle();
    if (connectionLookupError) return failure("Wallet verification is temporarily unavailable.", "server_configuration", 503);
    if (existingConnection && existingConnection.user_id !== authData.user.id) {
      return failure("This Testnet address is already connected to a different Pactset account. Sign in to that account or choose another wallet address.", "wallet_bound_elsewhere", 409);
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const nonce = randomNonce();
    const challenge = [
      "Pactset wallet ownership verification",
      `Account: ${publicKey}`,
      "Network: Stellar Testnet",
      `Network passphrase: ${Networks.TESTNET}`,
      `Pactset account: ${authData.user.id}`,
      `Issued at: ${issuedAt.toISOString()}`,
      `Expires at: ${expiresAt.toISOString()}`,
      `Nonce: ${nonce}`,
      "This signature does not authorize a transaction or transfer funds.",
    ].join("\n");

    await admin
      .from("wallet_challenges")
      .update({ used_at: issuedAt.toISOString() })
      .eq("user_id", authData.user.id)
      .is("used_at", null);
    const { data, error } = await admin
      .from("wallet_challenges")
      .insert({
        user_id: authData.user.id,
        public_key: publicKey,
        network: "TESTNET",
        nonce_hash: await sha256(nonce),
        challenge,
        expires_at: expiresAt.toISOString(),
      })
      .select("id,expires_at")
      .single();
    if (error || !data) return failure("Could not create wallet challenge", "challenge_create_failed", 500);
    return response({ challengeId: data.id, challenge, expiresAt: data.expires_at, network: "TESTNET" });
  }

  if (action === "verify") {
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const { data: challenge, error } = await admin
      .from("wallet_challenges")
      .select("id,user_id,public_key,network,challenge,expires_at,used_at")
      .eq("id", challengeId)
      .eq("user_id", authData.user.id)
      .eq("public_key", publicKey)
      .maybeSingle();
    if (error || !challenge) return failure("The wallet challenge is invalid. Start the connection again.", "challenge_invalid", 404);
    if (challenge.used_at) return failure("This wallet challenge has already been used. Start the connection again.", "challenge_used", 409);
    if (challenge.network !== "TESTNET" || new Date(challenge.expires_at).getTime() <= Date.now()) {
      return failure("The wallet challenge expired. Start the connection again.", "challenge_expired", 410);
    }

    let valid = false;
    try {
      const signature = decodeSignature(body.signature);
      valid = signature.length === 64 && Keypair.fromPublicKey(publicKey).verifyMessage(challenge.challenge, signature);
    } catch {
      valid = false;
    }
    if (!valid) return failure("The signature does not match this wallet challenge. Check the selected Freighter account and try again.", "signature_invalid", 401);

    const usedAt = new Date().toISOString();
    const { data: consumed, error: consumeError } = await admin
      .from("wallet_challenges")
      .update({ used_at: usedAt })
      .eq("id", challenge.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (consumeError || !consumed) return failure("This wallet challenge has already been used. Start the connection again.", "challenge_used", 409);

    const provider = typeof body.walletProvider === "string" ? body.walletProvider.slice(0, 48) : "Freighter";
    const { data: connection, error: connectionError } = await admin.rpc("activate_wallet_connection", {
      p_user_id: authData.user.id,
      p_public_key: publicKey,
      p_network: "TESTNET",
      p_wallet_provider: provider,
      p_verified_at: usedAt,
    });
    if (connectionError || !connection) {
      const bindingConflict = connectionError?.code === "23505";
      const message = bindingConflict
        ? "This Testnet address is already connected to a different Pactset account. Sign in to that account or choose another wallet address."
        : "Could not save the verified wallet";
      return failure(message, bindingConflict ? "wallet_bound_elsewhere" : "wallet_save_failed", bindingConflict ? 409 : 500);
    }
    return response({ connection: {
      public_key: connection.public_key,
      network: connection.network,
      wallet_provider: connection.wallet_provider,
      verified_at: connection.verified_at,
    } });
  }

  return failure("Unsupported action", "unsupported_action", 400);
});
