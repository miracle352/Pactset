import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const parseEnv = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const stellar = JSON.parse(await readFile(new URL("../../.stellar-testnet.local.json", import.meta.url), "utf8"));
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes("lvpsemqalftvcqkrjsyu")) throw new Error("Refusing to bind outside pactset-development");
if (stellar.network !== "TESTNET") throw new Error("Refusing to bind a non-Testnet wallet");
const support = identities.accounts.support;
if (!support?.email || !support?.password || !support?.userId) throw new Error("The existing support development identity is unavailable");
const resolver = stellar.accounts.resolver;
if (!resolver?.publicKey || !resolver?.secret) throw new Error("The ignored development resolver fixture is unavailable");

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email: support.email, password: support.password });
if (signedIn.error) throw signedIn.error;
const existing = await client.from("wallet_connections").select("public_key,network").eq("user_id", support.userId).eq("network", "TESTNET").eq("active", true).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data && existing.data.public_key !== resolver.publicKey) throw new Error("Support already owns a different Testnet wallet; refusing to replace it");
if (!existing.data) {
  const challenged = await client.functions.invoke("wallet-auth", { body: { action: "challenge", publicKey: resolver.publicKey, network: "TESTNET" } });
  if (challenged.error || !challenged.data?.challenge) throw new Error("Resolver ownership challenge failed");
  const signature = Keypair.fromSecret(resolver.secret).signMessage(challenged.data.challenge);
  const verified = await client.functions.invoke("wallet-auth", { body: { action: "verify", challengeId: challenged.data.challengeId, publicKey: resolver.publicKey, network: "TESTNET", walletProvider: "Automated development resolver fixture", signature: Buffer.from(signature).toString("base64") } });
  if (verified.error || verified.data?.connection?.public_key !== resolver.publicKey) throw new Error("Resolver ownership verification failed");
}
await client.auth.signOut();
console.log(JSON.stringify({ network: "TESTNET", supportUserId: support.userId, resolverPublicKey: resolver.publicKey, ownershipVerified: true, fixtureSigningOnly: true, secretsPrinted: false }, null, 2));
