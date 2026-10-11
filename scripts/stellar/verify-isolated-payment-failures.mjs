import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { chmod, readFile, writeFile } from "node:fs/promises";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const FIXTURE_FILE = new URL("../../.stellar-failure-fixtures.local.json", import.meta.url);
const PUBLIC_STATE_FILE = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const server = new Horizon.Server(HORIZON_URL);

function newAccount() {
  const pair = Keypair.random();
  return { publicKey: pair.publicKey(), secret: pair.secret() };
}

async function loadFixture() {
  try {
    return JSON.parse(await readFile(FIXTURE_FILE, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { network: "TESTNET", accounts: {}, results: {} };
  }
}

async function saveFixture(fixture) {
  await writeFile(FIXTURE_FILE, `${JSON.stringify(fixture, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(FIXTURE_FILE, 0o600).catch(() => undefined);
}

async function exists(publicKey) {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (error) {
    if (error?.response?.status === 404) return false;
    throw error;
  }
}

async function ensureFunded(account) {
  if (await exists(account.publicKey)) return;
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(account.publicKey)}`);
  if (!response.ok) throw new Error(`Friendbot failed with HTTP ${response.status}`);
  await response.json();
}

async function submit(source, operations, memo) {
  const account = await server.loadAccount(source.publicKey);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .setTimeout(180)
    .addMemo(Memo.text(memo.slice(0, 28)));
  for (const operation of operations) builder.addOperation(operation);
  const transaction = builder.build();
  transaction.sign(Keypair.fromSecret(source.secret));
  return server.submitTransaction(transaction);
}

function failureCodes(error) {
  const codes = error?.response?.data?.extras?.result_codes;
  return {
    transaction: codes?.transaction ?? null,
    operations: codes?.operations ?? [],
  };
}

function nativeBalance(account) {
  const balance = account.balances.find((item) => item.asset_type === "native");
  if (!balance) throw new Error("Disposable account has no native balance");
  return Number(balance.balance);
}

async function verifyMissingTrustline(fixture, tusd) {
  if (fixture.results.missingTrustline?.verified) return;
  const account = fixture.accounts.missingTrustline;
  await ensureFunded(account);
  const asset = new Asset("TUSD", tusd.issuer);
  const paths = await server.strictReceivePaths([Asset.native()], asset, "1.0000000").call();
  const path = paths.records.find((item) => item.source_asset_type === "native");
  if (!path) throw new Error("Existing TUSD liquidity was unavailable during missing-trustline verification");
  try {
    await submit(account, [Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: path.source_amount,
      destination: account.publicKey,
      destAsset: asset,
      destAmount: "1.0000000",
      path: path.path.map((item) => item.asset_type === "native" ? Asset.native() : new Asset(item.asset_code, item.asset_issuer)),
    })], "Pactset no trustline test");
    throw new Error("Missing-trustline transaction unexpectedly succeeded");
  } catch (error) {
    const codes = failureCodes(error);
    if (!codes.operations.includes("op_no_trust")) throw error;
    fixture.results.missingTrustline = { verified: true, expected: "op_no_trust", ...codes, checkedAt: new Date().toISOString() };
    await saveFixture(fixture);
  }
}

async function verifyInsufficientReserve(fixture, tusd) {
  if (fixture.results.insufficientReserve?.verified) return;
  const account = fixture.accounts.insufficientReserve;
  const sink = fixture.accounts.reserveSink;
  await Promise.all([ensureFunded(account), ensureFunded(sink)]);
  const loaded = await server.loadAccount(account.publicKey);
  const balance = nativeBalance(loaded);
  if (balance > 1.2) {
    const drain = (Math.floor((balance - 1.10002) * 10_000_000) / 10_000_000).toFixed(7);
    const result = await submit(account, [Operation.payment({ destination: sink.publicKey, asset: Asset.native(), amount: drain })], "Pactset reserve setup");
    fixture.results.reserveSetup = { hash: result.hash, ledger: result.ledger, retainedXlm: "1.1000200" };
    await saveFixture(fixture);
  }
  try {
    await submit(account, [Operation.changeTrust({ asset: new Asset("TUSD", tusd.issuer), limit: "10" })], "Pactset low reserve test");
    throw new Error("Insufficient-reserve trustline unexpectedly succeeded");
  } catch (error) {
    const codes = failureCodes(error);
    if (!codes.operations.includes("op_low_reserve")) throw error;
    fixture.results.insufficientReserve = { verified: true, expected: "op_low_reserve", ...codes, checkedAt: new Date().toISOString() };
    await saveFixture(fixture);
  }
}

async function verifyUnavailableLiquidity(fixture) {
  if (fixture.results.unavailableLiquidity?.verified) return;
  const issuer = fixture.accounts.unavailableIssuer;
  await ensureFunded(issuer);
  const unavailable = new Asset("TNOQ", issuer.publicKey);
  const paths = await server.strictReceivePaths([Asset.native()], unavailable, "1.0000000").call();
  const offers = await server.offers().forAccount(issuer.publicKey).limit(10).call();
  if (paths.records.length !== 0 || offers.records.length !== 0) {
    throw new Error("Disposable unprovisioned asset unexpectedly has a conversion path or offer");
  }
  fixture.results.unavailableLiquidity = {
    verified: true,
    expected: "no strict-receive path",
    assetCode: unavailable.code,
    issuer: unavailable.issuer,
    pathCount: 0,
    offerCount: 0,
    checkedAt: new Date().toISOString(),
  };
  await saveFixture(fixture);
}

async function main() {
  const fixture = await loadFixture();
  if (fixture.network !== "TESTNET") throw new Error("Refusing to run outside Stellar Testnet");
  for (const name of ["missingTrustline", "insufficientReserve", "reserveSink", "unavailableIssuer"]) {
    fixture.accounts[name] ??= newAccount();
  }
  await saveFixture(fixture);
  const publicState = JSON.parse(await readFile(PUBLIC_STATE_FILE, "utf8"));
  if (publicState.network !== "TESTNET" || publicState.assets?.TUSD?.liquidityStatus !== "ready") {
    throw new Error("The registered TUSD Testnet asset is not ready");
  }
  await verifyMissingTrustline(fixture, publicState.assets.TUSD);
  await verifyInsufficientReserve(fixture, publicState.assets.TUSD);
  await verifyUnavailableLiquidity(fixture);
  console.log(JSON.stringify({
    network: fixture.network,
    isolated: true,
    results: fixture.results,
    successfulDemoAgreementsTouched: false,
    secretsPrinted: false,
  }, null, 2));
}

await main();
