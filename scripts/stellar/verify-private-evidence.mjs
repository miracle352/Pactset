import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
}

const appEnv = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const url = appEnv.NEXT_PUBLIC_SUPABASE_URL;
const key = appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const AGREEMENT_ID = "e6625251-d065-4879-add7-8ea679ec1e62";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const fixture = await readFile(new URL("../../public/images/pavilion-light.webp", import.meta.url));
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signedIn(account) {
  const supabase = client();
  const result = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
  if (result.error) throw result.error;
  return supabase;
}

const supplier = await signedIn(state.accounts.supplier);
const { data: escrow, error: escrowError } = await supplier
  .from("agreement_escrows")
  .select("id,escrow_milestones(id,milestone_index,status)")
  .eq("agreement_id", AGREEMENT_ID)
  .single();
if (escrowError) throw escrowError;
const milestone = escrow.escrow_milestones.find((item) => item.milestone_index === 1);
if (!milestone) throw new Error("Evidence test milestone is missing");
const objectPath = `${AGREEMENT_ID}/${milestone.id}/automated-test-evidence.webp`;
const existing = await supplier.from("milestone_evidence")
  .select("id,object_path,status")
  .eq("milestone_id", milestone.id)
  .eq("submitted_by", state.accounts.supplier.userId)
  .eq("object_path", objectPath)
  .maybeSingle();
if (existing.error) throw existing.error;
let evidence = existing.data;
if (!evidence) {
  const upload = await supplier.storage.from("milestone-evidence").upload(objectPath, fixture, {
    contentType: "image/webp",
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const inserted = await supplier.from("milestone_evidence").insert({
    milestone_id: milestone.id,
    submitted_by: state.accounts.supplier.userId,
    note: "Automated Testnet fixture: venue setup evidence for access-control verification.",
    object_path: objectPath,
    media_type: "image/webp",
    size_bytes: fixture.byteLength,
    status: "submitted",
  }).select("id,object_path,status").single();
  if (inserted.error) throw inserted.error;
  evidence = inserted.data;
}

const organizer = await signedIn(state.accounts.organizer);
const organizerAccess = await organizer.storage.from("milestone-evidence").createSignedUrl(objectPath, 60);
const unrelated = await signedIn(state.accounts.unrelated);
const unrelatedAccess = await unrelated.storage.from("milestone-evidence").createSignedUrl(objectPath, 60);
const unrelatedRows = await unrelated.from("milestone_evidence").select("id").eq("id", evidence.id);

console.log(JSON.stringify({
  uploaded: !existing.data,
  reusedExistingFixture: Boolean(existing.data),
  privateBucket: true,
  organizerSignedUrlIssued: !organizerAccess.error && Boolean(organizerAccess.data?.signedUrl),
  unrelatedSignedUrlDenied: Boolean(unrelatedAccess.error),
  unrelatedMetadataRows: unrelatedRows.data?.length ?? 0,
  expiresInSeconds: 60,
}, null, 2));
