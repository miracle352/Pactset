import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const publicAccountRoles = ["organizer", "supplier", "crew"] as const;
export type AccountRole = (typeof publicAccountRoles)[number] | "support";

export async function getAccount() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return null;
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("account_roles").select("role,status").eq("user_id", userId).eq("status", "active"),
  ]);
  return { userId, email: typeof data?.claims?.email === "string" ? data.claims.email : "", profile, roles: (memberships ?? []).map((item) => item.role as AccountRole) };
}

export async function requireAccount(role?: AccountRole) {
  const account = await getAccount();
  if (!account) redirect(`/auth/sign-in?next=${encodeURIComponent(role ? `/workspace/${role}` : "/workspace")}`);
  if (role && !account.roles.includes(role)) redirect("/workspace?error=role-required");
  return account;
}
