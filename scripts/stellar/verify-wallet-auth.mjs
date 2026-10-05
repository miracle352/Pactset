import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
}

const appEnv = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const wallets = JSON.parse(await readFile(new URL("../../.stellar-testnet.local.json", import.meta.url), "utf8"));

async function signedIn(role) {
  const client = createClient(appEnv.NEXT_PUBLIC_SUPABASE_URL, appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: identities.accounts[role].email, password: identities.accounts[role].password });
  if (error) throw error;
  return client;
}

async function invoke(client, body) {
  try {
    const result = await client.functions.invoke("wallet-auth", { body });
    if (!result.error || result.data) return result;
    const details = { status: result.error.context?.status ?? null, body: null };
    try {
      details.body = await result.error.context?.clone().json();
    } catch {
      details.body = { message: result.error.message };
    }
    return { data: details, error: result.error };
  } catch (error) {
    let details = { status: error.context?.status ?? null, body: null };
    try {
      details.body = await error.context?.clone().json();
    } catch {
      details.body = { message: error instanceof Error ? error.message : "Function request failed" };
    }
    return { data: details, error };
  }
}

async function challenge(client, publicKey, network = "TESTNET") {
  const { data, error } = await invoke(client, { action: "challenge", publicKey, network });
  return { data, error };
}

async function verify(client, wallet, challengeData) {
  const signature = Keypair.fromSecret(wallet.secret).signMessage(challengeData.challenge);
  return invoke(client, {
      action: "verify",
      challengeId: challengeData.challengeId,
      publicKey: wallet.publicKey,
      network: "TESTNET",
      walletProvider: "Automated fixture",
      signature: Buffer.from(signature).toString("base64"),
  });
}

const results = {};
const organizer = await signedIn("organizer");
const wrongNetwork = await challenge(organizer, wallets.accounts.organizer.publicKey, "PUBLIC");
results.wrongNetworkRejected = Boolean(wrongNetwork.error);
const organizerChallenge = await challenge(organizer, wallets.accounts.organizer.publicKey);
if (organizerChallenge.error) throw new Error(`Organizer challenge failed: ${JSON.stringify(organizerChallenge.data)}`);
const organizerVerify = await verify(organizer, wallets.accounts.organizer, organizerChallenge.data);
if (organizerVerify.error) throw new Error(`Organizer verify failed: ${JSON.stringify(organizerVerify.data)}`);
results.organizerConnected = organizerVerify.data?.connection?.public_key === wallets.accounts.organizer.publicKey;
const replay = await verify(organizer, wallets.accounts.organizer, organizerChallenge.data);
results.replayRejected = Boolean(replay.error);
await organizer.auth.signOut();

const supplier = await signedIn("supplier");
const supplierChallenge = await challenge(supplier, wallets.accounts.supplier.publicKey);
if (supplierChallenge.error) throw new Error(`Supplier challenge failed: ${JSON.stringify(supplierChallenge.data)}`);
const supplierVerify = await verify(supplier, wallets.accounts.supplier, supplierChallenge.data);
if (supplierVerify.error) throw new Error(`Supplier verify failed: ${JSON.stringify(supplierVerify.data)}`);
results.supplierConnected = supplierVerify.data?.connection?.public_key === wallets.accounts.supplier.publicKey;

const claimedOrganizer = await challenge(supplier, wallets.accounts.organizer.publicKey);
if (claimedOrganizer.error) throw new Error(`Reuse challenge failed: ${JSON.stringify(claimedOrganizer.data)}`);
const duplicateBinding = await verify(supplier, wallets.accounts.organizer, claimedOrganizer.data);
results.crossAccountWalletReuseRejected = Boolean(duplicateBinding.error);
await supplier.auth.signOut();

console.log(JSON.stringify(results, null, 2));
if (!Object.values(results).every(Boolean)) process.exitCode = 1;
