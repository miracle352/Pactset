import { Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { chmod, readFile, writeFile } from "node:fs/promises";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const SECRET_FILE = new URL("../../.stellar-testnet.local.json", import.meta.url);
const PUBLIC_FILE = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const server = new Horizon.Server(HORIZON_URL);
const nonFiat = new Set(["BOV", "CHE", "CHW", "CLF", "COU", "MXV", "USN", "UYI", "UYW", "XAG", "XAU", "XBA", "XBB", "XBC", "XBD", "XDR", "XPD", "XPT", "XSU", "XTS", "XUA", "XXX"]);
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency").filter((code) => !nonFiat.has(code)));
const illustrativeRates = { USD: "0.5000000", EUR: "0.6000000" };

function newAccount() {
  const pair = Keypair.random();
  return { publicKey: pair.publicKey(), secret: pair.secret() };
}

async function loadState() {
  try {
    return JSON.parse(await readFile(SECRET_FILE, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { network: "TESTNET", accounts: {}, assets: {} };
  }
}

async function saveState(state) {
  await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(SECRET_FILE, 0o600).catch(() => undefined);
  const publicState = {
    network: state.network,
    horizonUrl: HORIZON_URL,
    accounts: Object.fromEntries(Object.entries(state.accounts).map(([name, account]) => [name, { publicKey: account.publicKey }])),
    assets: Object.fromEntries(Object.entries(state.assets).map(([code, asset]) => [code, {
      currencyCode: asset.currencyCode,
      currencyName: asset.currencyName,
      assetCode: asset.assetCode,
      issuer: asset.issuer,
      illustrativeXlmPerUnit: asset.illustrativeXlmPerUnit,
      provisioningStatus: asset.provisioningStatus,
      liquidityStatus: asset.liquidityStatus,
      offerId: asset.offerId,
      reverseOfferId: asset.reverseOfferId,
      transactionHashes: asset.transactionHashes,
    }])),
  };
  await writeFile(PUBLIC_FILE, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
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

async function ensureTrustline(account, asset) {
  const current = await server.loadAccount(account.publicKey);
  if (current.balances.some((balance) => balance.asset_code === asset.code && balance.asset_issuer === asset.issuer)) return null;
  return submit(account, [Operation.changeTrust({ asset, limit: "1000000000" })], `Pactset ${asset.code} trust`);
}

async function ensureIssued(issuer, distributor, asset) {
  const current = await server.loadAccount(distributor.publicKey);
  const balance = current.balances.find((item) => item.asset_code === asset.code && item.asset_issuer === asset.issuer);
  if (balance && Number(balance.balance) >= 500000) return null;
  return submit(issuer, [Operation.payment({ destination: distributor.publicKey, asset, amount: "1000000" })], `Pactset ${asset.code} issue`);
}

async function ensureOffer(distributor, asset, price) {
  const offers = await server.offers().forAccount(distributor.publicKey).limit(200).call();
  const existing = offers.records.find((offer) => offer.selling.asset_code === asset.code
    && offer.selling.asset_issuer === asset.issuer && offer.buying.asset_type === "native");
  if (existing) return { id: existing.id, hash: null };
  const result = await submit(distributor, [Operation.manageSellOffer({
    selling: asset,
    buying: Asset.native(),
    amount: "500000",
    price,
    offerId: "0",
  })], `Pactset ${asset.code} liquidity`);
  const refreshed = await server.offers().forAccount(distributor.publicKey).limit(200).call();
  const created = refreshed.records.find((offer) => offer.selling.asset_code === asset.code
    && offer.selling.asset_issuer === asset.issuer && offer.buying.asset_type === "native");
  if (!created) throw new Error(`Liquidity offer for ${asset.code} was not found after confirmation`);
  return { id: created.id, hash: result.hash };
}

async function ensureReverseOffer(distributor, asset, xlmPerUnit) {
  const offers = await server.offers().forAccount(distributor.publicKey).limit(200).call();
  const existing = offers.records.find((offer) => offer.selling.asset_type === "native"
    && offer.buying.asset_code === asset.code && offer.buying.asset_issuer === asset.issuer);
  if (existing) return { id: existing.id, hash: null };
  // Keep a deliberate 1% illustrative spread so the two development market
  // makers do not cross each other as soon as the reverse offer is created.
  const assetPerXlm = ((1 / Number(xlmPerUnit)) * 1.01).toFixed(7);
  const result = await submit(distributor, [Operation.manageSellOffer({
    selling: Asset.native(),
    buying: asset,
    amount: "1000",
    price: assetPerXlm,
    offerId: "0",
  })], `Pactset ${asset.code} payout path`);
  const refreshed = await server.offers().forAccount(distributor.publicKey).limit(200).call();
  const created = refreshed.records.find((offer) => offer.selling.asset_type === "native"
    && offer.buying.asset_code === asset.code && offer.buying.asset_issuer === asset.issuer);
  if (!created) throw new Error(`Reverse liquidity offer for ${asset.code} was not found after confirmation`);
  return { id: created.id, hash: result.hash };
}

async function main() {
  const requested = (process.argv.slice(2).length ? process.argv.slice(2) : ["USD", "EUR"])
    .map((value) => value.toUpperCase());
  for (const code of requested) {
    if (!/^[A-Z]{3}$/.test(code) || !supportedCurrencies.has(code)) throw new Error(`Unsupported ISO 4217 currency code: ${code}`);
  }
  const state = await loadState();
  if (state.network !== "TESTNET") throw new Error("Local provisioning state is not Testnet");
  for (const name of ["issuer", "liquidity", "payoutLiquidity", "organizer", "supplier", "crew", "resolver"]) {
    state.accounts[name] ??= newAccount();
  }
  await saveState(state);
  for (const account of Object.values(state.accounts)) await ensureFunded(account);

  for (const currencyCode of requested) {
    const assetCode = `T${currencyCode}`;
    const asset = new Asset(assetCode, state.accounts.issuer.publicKey);
    state.assets[assetCode] ??= {
      currencyCode,
      currencyName: currencyNames.of(currencyCode) ?? currencyCode,
      assetCode,
      issuer: state.accounts.issuer.publicKey,
      illustrativeXlmPerUnit: illustrativeRates[currencyCode] ?? "1.0000000",
      provisioningStatus: "provisioning",
      liquidityStatus: "seeding",
      transactionHashes: [],
    };
    await saveState(state);
    for (const name of ["liquidity", "payoutLiquidity", "organizer", "supplier", "crew"]) {
      const result = await ensureTrustline(state.accounts[name], asset);
      if (result?.hash) state.assets[assetCode].transactionHashes.push(result.hash);
    }
    const issuance = await ensureIssued(state.accounts.issuer, state.accounts.liquidity, asset);
    if (issuance?.hash) state.assets[assetCode].transactionHashes.push(issuance.hash);
    const offer = await ensureOffer(state.accounts.liquidity, asset, state.assets[assetCode].illustrativeXlmPerUnit);
    if (offer.hash) state.assets[assetCode].transactionHashes.push(offer.hash);
    const reverseOffer = await ensureReverseOffer(state.accounts.payoutLiquidity, asset, state.assets[assetCode].illustrativeXlmPerUnit);
    if (reverseOffer.hash) state.assets[assetCode].transactionHashes.push(reverseOffer.hash);
    state.assets[assetCode].offerId = offer.id;
    state.assets[assetCode].reverseOfferId = reverseOffer.id;
    state.assets[assetCode].provisioningStatus = "ready";
    state.assets[assetCode].liquidityStatus = "ready";
    await saveState(state);
  }
  console.log(JSON.stringify({
    network: "TESTNET",
    issuer: state.accounts.issuer.publicKey,
    assets: requested.map((currencyCode) => {
      const item = state.assets[`T${currencyCode}`];
      return { assetCode: item.assetCode, issuer: item.issuer, offerId: item.offerId, reverseOfferId: item.reverseOfferId, status: item.liquidityStatus, transactionHashes: item.transactionHashes };
    }),
    publicStateFile: ".stellar-testnet-state.local.json",
    secretStateStored: true,
  }, null, 2));
}

await main();
