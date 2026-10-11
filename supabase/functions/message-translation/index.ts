import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const languagePattern = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authorization) return reply({ error: "Translation unavailable", code: "configuration_unavailable" }, 503);

  let input: { messageId?: string; targetLanguage?: string };
  try { input = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const messageId = typeof input.messageId === "string" ? input.messageId : "";
  const targetLanguage = typeof input.targetLanguage === "string" ? input.targetLanguage.trim().toLowerCase() : "";
  if (!/^[0-9a-f-]{36}$/.test(messageId) || !languagePattern.test(targetLanguage)) return reply({ error: "Invalid translation request" }, 400);

  const member = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: requested, error: requestError } = await member.rpc("request_message_translation", { p_message_id: messageId, p_target_language: targetLanguage });
  if (requestError || !requested) return reply({ error: requestError?.message ?? "Message not found", code: "not_authorized" }, requestError?.message.includes("rate limit") ? 429 : 404);

  const { data: message, error: messageError } = await member.from("agreement_messages").select("id,body_original,language_code,updated_at").eq("id", messageId).single();
  if (messageError || !message) return reply({ error: "Message not found", code: "not_authorized" }, 404);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (message.language_code === targetLanguage) {
    await admin.from("agreement_message_translations").update({ status: "available", translated_body: message.body_original, provider: "original", error_code: null, completed_at: new Date().toISOString() }).eq("message_id", messageId).eq("target_language", targetLanguage);
    return reply({ status: "available", targetLanguage });
  }

  const endpoint = Deno.env.get("PACTSET_TRANSLATION_ENDPOINT");
  const apiKey = Deno.env.get("PACTSET_TRANSLATION_API_KEY");
  if (!endpoint || !apiKey) {
    await admin.from("agreement_message_translations").update({ status: "unavailable", provider: null, error_code: "provider_not_configured", completed_at: new Date().toISOString() }).eq("message_id", messageId).eq("target_language", targetLanguage);
    return reply({ error: "Machine translation is not configured yet. The original message remains available.", code: "provider_not_configured" }, 503);
  }

  try {
    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ text: message.body_original, sourceLanguage: message.language_code === "und" ? null : message.language_code, targetLanguage, preserve: ["amounts", "asset_codes", "dates", "agreement_references"] }),
      signal: AbortSignal.timeout(12_000),
    });
    const providerBody = await providerResponse.json().catch(() => ({})) as { translatedText?: unknown; detectedLanguage?: unknown };
    const translatedText = typeof providerBody.translatedText === "string" ? providerBody.translatedText.trim() : "";
    if (!providerResponse.ok || !translatedText || translatedText.length > 8000) throw new Error("provider_failed");
    await admin.from("agreement_message_translations").update({ status: "available", translated_body: translatedText, provider: "configured_provider", error_code: null, completed_at: new Date().toISOString() }).eq("message_id", messageId).eq("target_language", targetLanguage);
    return reply({ status: "available", targetLanguage, detectedLanguage: typeof providerBody.detectedLanguage === "string" ? providerBody.detectedLanguage : null });
  } catch {
    await admin.from("agreement_message_translations").update({ status: "failed", provider: "configured_provider", error_code: "provider_failed", completed_at: new Date().toISOString() }).eq("message_id", messageId).eq("target_language", targetLanguage);
    return reply({ error: "Translation failed. The original message is still available.", code: "provider_failed" }, 502);
  }
});
