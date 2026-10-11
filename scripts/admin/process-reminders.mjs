import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(new URL("../../.env.local", import.meta.url), "utf8");
const local = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY only in ignored local configuration before running the reminder worker.");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const scheduled = await supabase.rpc("refresh_scheduled_reminders");
if (scheduled.error) throw new Error(`Reminder refresh failed: ${scheduled.error.message}`);
const delivered = await supabase.rpc("deliver_due_reminders", { p_limit: 100 });
if (delivered.error) throw new Error(`Reminder delivery failed: ${delivered.error.message}`);
console.log(JSON.stringify({ scheduled: scheduled.data, delivered: delivered.data, channel: "in_app", backgroundGuarantee: false, secretsPrinted: false }, null, 2));
