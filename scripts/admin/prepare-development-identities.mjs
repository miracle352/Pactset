import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const stateUrl = new URL("../../.stage2a-test-state.local.json", import.meta.url);
const roles = new Set(["crew2", "support"]);
const fields = new Set(["email", "password"]);

function password() {
  return `${randomBytes(30).toString("base64url")}aA7!`;
}

const state = JSON.parse(await readFile(stateUrl, "utf8"));
state.accounts ??= {};

for (const role of roles) {
  state.accounts[role] ??= {
    email: `pactset.stage2b.${role}.${state.runId}@gmail.com`,
    password: password(),
    provisioningStatus: "prepared",
  };
}

await writeFile(stateUrl, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });

const [command, role, field] = process.argv.slice(2);
if (command === "clipboard") {
  if (!roles.has(role) || !fields.has(field)) throw new Error("Unsupported credential selection");
  const value = state.accounts[role][field];
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", "$input | Set-Clipboard"], {
    input: value,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error("Could not stage the credential in the local clipboard");
} else if (command === "mark-created") {
  if (!roles.has(role)) throw new Error("Unsupported development identity");
  state.accounts[role].provisioningStatus = "created";
  if (field) state.accounts[role].userId = field;
  await writeFile(stateUrl, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
} else if (command === "import-clipboard") {
  if (!roles.has(role) || field !== "password") throw new Error("Unsupported credential import");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const value = result.stdout.trim();
  if (result.status !== 0 || value.length < 24) throw new Error("Could not import the generated credential");
  state.accounts[role].password = value;
  await writeFile(stateUrl, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

console.log(JSON.stringify({ prepared: [...roles].filter((item) => state.accounts[item]), command: command ?? "prepare", secretsPrinted: false }));
