import { type NextRequest, NextResponse } from "next/server";
import { publicAccountRoles } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextValue = url.searchParams.get("next");
  const next = nextValue?.startsWith("/") && !nextValue.startsWith("//") ? nextValue : "/workspace";
  if (!isSupabaseConfigured() || !code) return NextResponse.redirect(new URL("/auth/sign-in?error=invalid-confirmation", url.origin));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/auth/sign-in?error=expired-confirmation", url.origin));
  const role = url.searchParams.get("role");
  if (publicAccountRoles.includes(role as (typeof publicAccountRoles)[number])) {
    const { error: roleError } = await supabase.from("account_roles").insert({ user_id: data.user.id, role });
    if (roleError && roleError.code !== "23505") return NextResponse.redirect(new URL("/settings?error=role-assignment", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
