import { Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SECRET_FILE = new URL("../../.stellar-testnet.local.json", import.meta.url);
const PUBLIC_FILE = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const CLI = join(process.env.USERPROFILE ?? "", ".cargo", "bin", "stellar.exe");
const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const AGREEMENT_ID = "e6625251-d065-4879-add7-8ea679ec1e62";
const DESTINATION_AMOUNT = "2250.0000000";
const QUOTE_LIFETIME_MS = 2 * 60 * 1000;
const SLIPPAGE_BPS = 50n;

function decimalToStroops(value) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0").slice(0, 7));
}

function stroopsToDecimal(value) {
  const whole = value / 10_000_000n;
  const fraction = (value % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

function assetFromPath(value) {
  if (value.asset_type === "native") return Asset.native();
  return new Asset(value.asset_code, value.asset_issuer);
}

function runCli(args, secret) {
  const result = spawnSync(CLI, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, STELLAR_ACCOUNT: secret, STELLAR_NETWORK: "testnet" },
    windowsHide: true,
  });
  const output = `${result.stdout}\n${result.stderr}`.replaceAll(secret, "[REDACTED]").trim();
  if (result.status !== 0) throw new Error(`Stellar CLI failed: ${output}`);
  return output;
}

function transactionHash(output) {
  const labelled = output.match(/(?:transaction|tx)(?:\s+hash)?[^0-9a-f]*([0-9a-f]{64})/i);
  if (labelled) return labelled[1].toLowerCase();
  const explorer = output.match(/\/tx\/([0-9a-f]{64})/i);
  return explorer?.[1]?.toLowerCase() ?? null;
}

async function assetBalance(publicKey, assetCode, issuer) {
  const account = await server.loadAccount(publicKey);
  const balance = account.balances.find((item) => item.asset_code === assetCode && item.asset_issuer === issuer);
  return balance?.balance ?? "0.0000000";
}

async function submitConversion(state, quote) {
  const source = state.accounts.organizer;
  const account = await server.loadAccount(source.publicKey);
  const destinationAsset = new Asset("TUSD", state.assets.TUSD.issuer);
  const transaction = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .setTimeout(180)
    .addMemo(Memo.text("Pactset TUSD conversion"))
    .addOperation(Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: quote.sendMax,
      destination: source.publicKey,
      destAsset: destinationAsset,
      destAmount: DESTINATION_AMOUNT,
      path: quote.path.map(assetFromPath),
    }))
    .build();
  transaction.sign(Keypair.fromSecret(source.secret));
  return server.submitTransaction(transaction);
}

async function main() {
  const state = JSON.parse(await readFile(SECRET_FILE, "utf8"));
  const publicState = JSON.parse(await readFile(PUBLIC_FILE, "utf8"));
  if (state.network !== "TESTNET") throw new Error("Refusing to run outside Testnet");
  const escrow = state.escrows?.[AGREEMENT_ID];
  if (!escrow?.contractAddress) throw new Error("Escrow must be deployed first");
  const issuer = state.assets.TUSD.issuer;
  state.journeys ??= {};
  const journey = state.journeys[AGREEMENT_ID] ??= { network: "TESTNET", steps: {} };

  if (!journey.steps.conversion?.hash) {
    const paths = await server.strictReceivePaths([Asset.native()], new Asset("TUSD", issuer), DESTINATION_AMOUNT).call();
    const path = paths.records.find((record) => record.source_asset_type === "native");
    if (!path) throw new Error("No XLM → TUSD path is available from the seeded Testnet offer");
    const expected = decimalToStroops(path.source_amount);
    const sendMaxStroops = (expected * (10_000n + SLIPPAGE_BPS) + 9_999n) / 10_000n;
    const quote = {
      inputAsset: "XLM",
      outputAsset: `TUSD:${issuer}`,
      expectedInput: path.source_amount,
      exactOutput: DESTINATION_AMOUNT,
      networkFeeStroops: BASE_FEE,
      slippageBps: Number(SLIPPAGE_BPS),
      sendMax: stroopsToDecimal(sendMaxStroops),
      path: path.path,
      rateSource: "Pactset-seeded illustrative Stellar Testnet liquidity",
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString(),
    };
    if (Date.now() >= Date.parse(quote.expiresAt)) throw new Error("Quote expired before signing");
    const before = await assetBalance(state.accounts.organizer.publicKey, "TUSD", issuer);
    const result = await submitConversion(state, quote);
    const after = await assetBalance(state.accounts.organizer.publicKey, "TUSD", issuer);
    journey.steps.conversion = { hash: result.hash, ledger: result.ledger, before, after, quote, confirmedAt: new Date().toISOString() };
    await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  if (!journey.steps.funding?.confirmed) {
    const output = runCli([
      "contract", "invoke", "--contract-id", escrow.contractAddress, "--network", "testnet", "--", "fund",
    ], state.accounts.organizer.secret);
    journey.steps.funding = { confirmed: true, hash: transactionHash(output), confirmedAt: new Date().toISOString() };
    await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  if (!journey.steps.submission?.confirmed) {
    const output = runCli([
      "contract", "invoke", "--contract-id", escrow.contractAddress, "--network", "testnet", "--", "submit", "--index", "0",
    ], state.accounts.supplier.secret);
    journey.steps.submission = { confirmed: true, hash: transactionHash(output), confirmedAt: new Date().toISOString() };
    await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  if (!journey.steps.release?.confirmed) {
    const providerBefore = await assetBalance(state.accounts.supplier.publicKey, "TUSD", issuer);
    const output = runCli([
      "contract", "invoke", "--contract-id", escrow.contractAddress, "--network", "testnet", "--", "approve_release", "--index", "0",
    ], state.accounts.organizer.secret);
    const providerAfter = await assetBalance(state.accounts.supplier.publicKey, "TUSD", issuer);
    journey.steps.release = {
      confirmed: true,
      hash: transactionHash(output),
      amount: "750.0000000",
      providerBefore,
      providerAfter,
      confirmedAt: new Date().toISOString(),
    };
    await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  const milestonesOutput = runCli([
    "contract", "invoke", "--contract-id", escrow.contractAddress, "--network", "testnet", "--send", "no", "--", "get_milestones",
  ], state.accounts.organizer.secret);
  publicState.journeys ??= {};
  publicState.journeys[AGREEMENT_ID] = {
    network: "TESTNET",
    conversion: journey.steps.conversion,
    funding: journey.steps.funding,
    evidenceSubmission: journey.steps.submission,
    release: journey.steps.release,
    milestonesOutput,
  };
  await writeFile(PUBLIC_FILE, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ agreementId: AGREEMENT_ID, contractAddress: escrow.contractAddress, ...publicState.journeys[AGREEMENT_ID] }, null, 2));
}

await main();
