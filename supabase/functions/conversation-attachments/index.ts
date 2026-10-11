import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const allowed = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["video/mp4", "mp4"], ["video/webm", "webm"], ["application/pdf", "pdf"],
  ["text/plain", "txt"], ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authorization) return reply({ error: "Attachment service unavailable" }, 503);
  const member = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData } = await member.auth.getUser(); const user = authData.user;
  if (!user) return reply({ error: "Authentication required" }, 401);
  let input: { action?: string; agreementId?: string; attachmentId?: string; name?: string; mediaType?: string; size?: number };
  try { input = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const action = input.action;

  if (action === "prepare") {
    if (!input.agreementId || !uuidPattern.test(input.agreementId)) return reply({ error: "Invalid agreement" }, 400);
    const extension = input.mediaType ? allowed.get(input.mediaType) : undefined;
    const size = Number(input.size);
    if (!extension || !Number.isSafeInteger(size) || size < 1 || size > 26_214_400) return reply({ error: "Choose a JPG, PNG, WebP, MP4, WebM, PDF, TXT, or DOCX file up to 25 MB." }, 400);
    const { data: canAccess } = await member.rpc("can_access_agreement_conversation", { p_agreement_id: input.agreementId });
    if (!canAccess) return reply({ error: "Conversation not found" }, 404);
    const { data: stale } = await admin.from("agreement_message_attachments").select("id,object_path").eq("uploaded_by", user.id).eq("status", "pending").lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (stale?.length) { await admin.storage.from("conversation-attachments").remove(stale.map((row) => row.object_path)); await admin.from("agreement_message_attachments").delete().in("id", stale.map((row) => row.id)); }
    const id = crypto.randomUUID(); const path = `${input.agreementId}/${user.id}/${id}.${extension}`;
    const safeName = String(input.name ?? `attachment.${extension}`).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 180) || `attachment.${extension}`;
    const { error } = await admin.from("agreement_message_attachments").insert({ id, agreement_id: input.agreementId, uploaded_by: user.id, object_path: path, original_name: safeName, media_type: input.mediaType, size_bytes: size });
    if (error) return reply({ error: "Attachment could not be prepared" }, 500);
    return reply({ attachmentId: id, objectPath: path, bucket: "conversation-attachments" });
  }

  if (!input.attachmentId || !uuidPattern.test(input.attachmentId)) return reply({ error: "Invalid attachment" }, 400);
  const { data: attachment } = await admin.from("agreement_message_attachments").select("*").eq("id", input.attachmentId).maybeSingle();
  if (!attachment) return reply({ error: "Attachment not found" }, 404);
  const { data: canAccess } = await member.rpc("can_access_agreement_conversation", { p_agreement_id: attachment.agreement_id });
  if (!canAccess) return reply({ error: "Attachment not found" }, 404);
  if (action === "cancel") {
    if (attachment.uploaded_by !== user.id || attachment.status !== "pending") return reply({ error: "Attachment cannot be cancelled" }, 403);
    await admin.storage.from("conversation-attachments").remove([attachment.object_path]);
    await admin.from("agreement_message_attachments").delete().eq("id", attachment.id).eq("uploaded_by", user.id).eq("status", "pending");
    return reply({ status: "cancelled" });
  }
  if (action === "download") {
    if (attachment.status !== "attached") return reply({ error: "Attachment is not available" }, 409);
    const { data, error } = await admin.storage.from("conversation-attachments").createSignedUrl(attachment.object_path, 60, { download: attachment.original_name });
    if (error || !data?.signedUrl) return reply({ error: "Download link could not be created" }, 500);
    return reply({ url: data.signedUrl, expiresIn: 60 });
  }
  return reply({ error: "Unsupported action" }, 400);
});
