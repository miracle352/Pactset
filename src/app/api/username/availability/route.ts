import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

export async function GET(request: NextRequest) {
  const username = normalizeUsername(request.nextUrl.searchParams.get("username") ?? "");
  const validation = usernameValidationMessage(username);
  if (validation) return NextResponse.json({ status: "invalid", message: validation }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: ownProfile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    if (normalizeUsername(ownProfile?.username ?? "") === username) {
      return NextResponse.json({ status: "available", message: "This is your current username." }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  const { data, error } = await supabase.rpc("username_available", { p_username: username });
  if (error) return NextResponse.json({ status: "unavailable", message: "Availability could not be checked. You can still try saving." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ status: data ? "available" : "taken", message: data ? "Username is available." : "That username is already in use." }, { headers: { "Cache-Control": "no-store" } });
}
