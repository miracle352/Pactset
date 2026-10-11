import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const secretsPath = new URL("../../.stellar-testnet.local.json", import.meta.url);
const publicPath = new URL("../../.stellar-testnet-state.local.json", import.meta.url);
const secrets = JSON.parse(await readFile(secretsPath, "utf8"));
const publicState = JSON.parse(await readFile(publicPath, "utf8"));
const agreementId = "e6625251-d065-4879-add7-8ea679ec1e62";
const contract = secrets.escrows[agreementId].contractAddress;
const cli = join(process.env.USERPROFILE ?? "", ".cargo", "bin", "stellar.exe");

if (publicState.controlVerification?.agreementId === agreementId) {
  console.log(JSON.stringify({ ...publicState.controlVerification, reusedExistingVerification: true }, null, 2));
  process.exit(0);
}

function invoke(account, args, expectFailure = false) {
  const result = spawnSync(cli, ["contract", "invoke", "--contract-id", contract, "--network", "testnet", "--", ...args], {
    cwd: process.cwd(), encoding: "utf8", windowsHide: true,
    env: { ...process.env, STELLAR_ACCOUNT: account.secret, STELLAR_NETWORK: "testnet" },
  });
  const output = `${result.stdout}\n${result.stderr}`.replaceAll(account.secret, "[REDACTED]");
  if (expectFailure) {
    if (result.status === 0) throw new Error(`Expected ${args[0]} to fail`);
    return { rejected: true };
  }
  if (result.status !== 0) throw new Error(output.trim());
  const hash = output.match(/\/tx\/([0-9a-f]{64})/i)?.[1]?.toLowerCase()
    ?? output.match(/(?:transaction|tx)(?:\s+hash)?[^0-9a-f]*([0-9a-f]{64})/i)?.[1]?.toLowerCase();
  return { confirmed: true, hash };
}

const checks = {};
checks.repeatedRelease = invoke(secrets.accounts.organizer, ["approve_release", "--index", "0"], true);
checks.unauthorizedRelease = invoke(secrets.accounts.supplier, ["approve_release", "--index", "2"], true);
checks.submission = invoke(secrets.accounts.supplier, ["submit", "--index", "1"]);
checks.dispute = invoke(secrets.accounts.organizer, ["dispute", "--actor", secrets.accounts.organizer.publicKey, "--index", "1"]);
checks.disputedOrdinaryRelease = invoke(secrets.accounts.organizer, ["approve_release", "--index", "1"], true);
checks.resolverRefund = invoke(secrets.accounts.resolver, ["resolve", "--index", "1", "--resolution", "RefundToPayer"]);

const readResult = spawnSync(cli, ["contract", "invoke", "--contract-id", contract, "--network", "testnet", "--send", "no", "--", "get_milestones"], {
  cwd: process.cwd(), encoding: "utf8", windowsHide: true,
  env: { ...process.env, STELLAR_ACCOUNT: secrets.accounts.organizer.secret, STELLAR_NETWORK: "testnet" },
});
if (readResult.status !== 0) throw new Error(`${readResult.stdout}\n${readResult.stderr}`.replaceAll(secrets.accounts.organizer.secret, "[REDACTED]"));
const milestones = readResult.stdout.trim();
publicState.controlVerification = { agreementId, contract, checks, milestones, verifiedAt: new Date().toISOString() };
await writeFile(publicPath, `${JSON.stringify(publicState, null, 2)}\n`, "utf8");
console.log(JSON.stringify(publicState.controlVerification, null, 2));
