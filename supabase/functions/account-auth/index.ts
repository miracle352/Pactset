import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return reply({ error: "Sign-in unavailable" }, 503);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "", password = typeof body.password === "string" ? body.password : "";
  if (body.action !== "username-sign-in" || !/^[a-z0-9][a-z0-9_]{2,29}$/.test(username) || password.length < 10 || password.length > 128) return reply({ error: "Invalid credentials" }, 400);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (!profile?.id) return reply({ error: "Invalid credentials" }, 400);
  const { data } = await admin.auth.admin.getUserById(profile.id);
  if (!data.user?.email) return reply({ error: "Invalid credentials" }, 400);
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sessionData, error } = await auth.auth.signInWithPassword({ email: data.user.email, password });
  if (error || !sessionData.session) return reply({ error: "Invalid credentials" }, 400);
  return reply({ access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token });
});
