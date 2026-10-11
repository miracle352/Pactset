import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SECRET_FILE = new URL("../../.stellar-testnet.local.json", import.meta.url);
const PUBLIC_FILE = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const CLI = join(process.env.USERPROFILE ?? "", ".cargo", "bin", "stellar.exe");
const WASM = join(process.cwd(), "contracts", "target", "wasm32v1-none", "release", "pactset_escrow.wasm");
const fixtures = [
  { id: "342466d3-c812-4dcb-ad12-9d9f373a70d4", currency: "TUSD", amount: "30.0000000", label: "Fresh TUSD browser payment completion" },
  { id: "69cd95a1-9651-4484-bd26-b4e2ff61ace4", currency: "TEUR", amount: "20.0000000", label: "Fresh TEUR generic conversion completion" },
];

function run(args, secret) {
  const result = spawnSync(CLI, args, { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, STELLAR_ACCOUNT: secret, STELLAR_NETWORK: "testnet" }, windowsHide: true });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.replaceAll(secret, "[REDACTED]").trim());
  return `${result.stdout}\n${result.stderr}`;
}

function contractId(output) {
  const match = output.match(/C[A-Z2-7]{55}/);
  if (!match) throw new Error("Contract deployment did not return an address");
  return match[0];
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const state = JSON.parse(await readFile(SECRET_FILE, "utf8"));
const publicState = JSON.parse(await readFile(PUBLIC_FILE, "utf8"));
if (state.network !== "TESTNET") throw new Error("Refusing to deploy outside Stellar Testnet");
state.escrows ??= {};
publicState.escrows ??= {};

for (const fixture of fixtures) {
  const asset = state.assets[fixture.currency];
  if (!asset?.stellarAssetContract) throw new Error(`${fixture.currency} asset contract is not provisioned`);
  if (!state.escrows[fixture.id]) {
    const agreementHash = hash(fixture.id);
    const termsHash = hash(JSON.stringify({ ...fixture, version: 1, payer: state.accounts.organizer.publicKey, payee: state.accounts.supplier.publicKey, resolver: state.accounts.resolver.publicKey, asset: asset.stellarAssetContract }));
    const output = run(["contract", "deploy", "--wasm", WASM, "--network", "testnet", "--quiet", "--", "--agreement-hash", agreementHash, "--agreement-version", "1", "--payer", state.accounts.organizer.publicKey, "--payee", state.accounts.supplier.publicKey, "--resolver", state.accounts.resolver.publicKey, "--asset", asset.stellarAssetContract, "--amounts", JSON.stringify([(BigInt(fixture.amount.replace(".", ""))).toString()]), "--terms-hash", termsHash], state.accounts.organizer.secret);
    state.escrows[fixture.id] = { contractAddress: contractId(output), agreementHash, termsHash, assetCode: fixture.currency };
  }
  publicState.escrows[fixture.id] = { ...state.escrows[fixture.id], payer: state.accounts.organizer.publicKey, payee: state.accounts.supplier.publicKey, resolver: state.accounts.resolver.publicKey, total: fixture.amount, milestones: [fixture.amount], label: fixture.label };
}

await writeFile(SECRET_FILE, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await writeFile(PUBLIC_FILE, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ network: "TESTNET", fixtures: Object.fromEntries(fixtures.map((fixture) => [fixture.id, publicState.escrows[fixture.id]])), secretsPrinted: false }, null, 2));
