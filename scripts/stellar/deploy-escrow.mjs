import { Asset, Networks } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SECRET_FILE = new URL("../../.stellar-testnet.local.json", import.meta.url);
const PUBLIC_FILE = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const WASM = join(process.cwd(), "contracts", "target", "wasm32v1-none", "release", "pactset_escrow.wasm");
const CLI = join(process.env.USERPROFILE ?? "", ".cargo", "bin", "stellar.exe");
const AGREEMENT = {
  id: "e6625251-d065-4879-add7-8ea679ec1e62",
  version: 2,
  scope: "Deliver and operate six lighting kits with a rehearsal check.",
  currency: "TUSD",
  total: "2250.0000000",
  milestones: ["7500000000", "7500000000", "7500000000"],
  cancellationTerms: "Accepted Stage 2A agreement terms; disputed funds require the disclosed resolver.",
};

function run(args, secret) {
  const result = spawnSync(CLI, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, STELLAR_ACCOUNT: secret, STELLAR_NETWORK: "testnet" },
    windowsHide: true,
  });
  if (result.status !== 0) {
    const safeError = `${result.stderr}\n${result.stdout}`.replaceAll(secret, "[REDACTED]").trim();
    throw new Error(`Stellar CLI failed: ${safeError}`);
  }
  return `${result.stdout}\n${result.stderr}`.trim();
}

function contractId(output) {
  const match = output.match(/C[A-Z2-7]{55}/);
  if (!match) throw new Error(`No contract address found in Stellar CLI output: ${output}`);
  return match[0];
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function save(state) {
  await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  const publicState = JSON.parse(await readFile(PUBLIC_FILE, "utf8"));
  for (const [code, asset] of Object.entries(state.assets)) {
    if (publicState.assets[code]) publicState.assets[code].stellarAssetContract = asset.stellarAssetContract;
  }
  publicState.escrows ??= {};
  if (state.escrows?.[AGREEMENT.id]) {
    const escrow = state.escrows[AGREEMENT.id];
    publicState.escrows[AGREEMENT.id] = {
      contractAddress: escrow.contractAddress,
      agreementHash: escrow.agreementHash,
      termsHash: escrow.termsHash,
      assetCode: escrow.assetCode,
      payer: state.accounts.organizer.publicKey,
      payee: state.accounts.supplier.publicKey,
      resolver: state.accounts.resolver.publicKey,
      total: AGREEMENT.total,
      milestones: AGREEMENT.milestones,
    };
  }
  await writeFile(PUBLIC_FILE, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
}

async function main() {
  const state = JSON.parse(await readFile(SECRET_FILE, "utf8"));
  if (state.network !== "TESTNET") throw new Error("Refusing to deploy outside Testnet");
  for (const assetCode of ["TUSD", "TEUR"]) {
    const item = state.assets[assetCode];
    if (!item || item.provisioningStatus !== "ready") throw new Error(`${assetCode} must be provisioned first`);
    item.stellarAssetContract ??= contractId(run([
      "contract", "asset", "deploy", "--asset", `${assetCode}:${item.issuer}`, "--network", "testnet", "--quiet",
    ], state.accounts.organizer.secret));
    const derived = new Asset(assetCode, item.issuer).contractId(Networks.TESTNET);
    if (item.stellarAssetContract !== derived) throw new Error(`${assetCode} SAC address does not match the deterministic asset contract ID`);
    await save(state);
  }

  state.escrows ??= {};
  if (!state.escrows[AGREEMENT.id]) {
    const agreementHash = hash(AGREEMENT.id);
    const termsHash = hash(JSON.stringify({
      id: AGREEMENT.id,
      version: AGREEMENT.version,
      scope: AGREEMENT.scope,
      currency: AGREEMENT.currency,
      total: AGREEMENT.total,
      milestones: AGREEMENT.milestones,
      cancellationTerms: AGREEMENT.cancellationTerms,
      payer: state.accounts.organizer.publicKey,
      payee: state.accounts.supplier.publicKey,
      resolver: state.accounts.resolver.publicKey,
      asset: state.assets.TUSD.stellarAssetContract,
    }));
    const output = run([
      "contract", "deploy", "--wasm", WASM, "--network", "testnet", "--quiet", "--",
      "--agreement-hash", agreementHash,
      "--agreement-version", String(AGREEMENT.version),
      "--payer", state.accounts.organizer.publicKey,
      "--payee", state.accounts.supplier.publicKey,
      "--resolver", state.accounts.resolver.publicKey,
      "--asset", state.assets.TUSD.stellarAssetContract,
      "--amounts", JSON.stringify(AGREEMENT.milestones),
      "--terms-hash", termsHash,
    ], state.accounts.organizer.secret);
    state.escrows[AGREEMENT.id] = {
      contractAddress: contractId(output),
      agreementHash,
      termsHash,
      assetCode: "TUSD",
    };
    await save(state);
  }

  console.log(JSON.stringify({
    network: "TESTNET",
    stellarAssetContracts: Object.fromEntries(["TUSD", "TEUR"].map((code) => [code, state.assets[code].stellarAssetContract])),
    escrow: { agreementId: AGREEMENT.id, ...state.escrows[AGREEMENT.id] },
    secretsPrinted: false,
  }, null, 2));
}

await main();
