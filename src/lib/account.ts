import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

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

export async function requireAccount(role?: AccountRole, returnTo?: string) {
  const account = await getAccount();
  if (!account) redirect(`/auth/sign-in?next=${encodeURIComponent(safeInternalPath(returnTo, role ? `/workspace/${role}` : "/workspace"))}`);
  if (role && !account.roles.includes(role)) redirect("/workspace?error=role-required");
  return account;
}

export async function preferredWorkspaceRole(account: { roles: AccountRole[] }) {
  const preferred = (await cookies()).get("pactset-role-v1")?.value as AccountRole | undefined;
  return preferred && account.roles.includes(preferred) ? preferred : account.roles[0];
}

export function defaultWorkspaceNav(role: AccountRole) {
  if (role === "organizer") return [{ label: "Overview", href: "/workspace/organizer" }, { label: "Events", href: "/workspace/organizer/events" }, { label: "Requests", href: "/workspace/organizer#requests" }, { label: "Offers", href: "/workspace/organizer#offers" }, { label: "Agreements", href: "/workspace/organizer#agreements" }];
  if (role === "supplier") return [{ label: "Overview", href: "/workspace/supplier" }, { label: "Inventory", href: "/workspace/supplier/inventory" }, { label: "Requests", href: "/workspace/supplier#opportunities" }, { label: "Offers", href: "/workspace/supplier#offers" }, { label: "Bookings", href: "/workspace/supplier#bookings" }];
  if (role === "crew") return [{ label: "Overview", href: "/workspace/crew" }, { label: "Opportunities", href: "/workspace/crew#opportunities" }, { label: "Offers", href: "/workspace/crew#offers" }, { label: "Jobs", href: "/workspace/crew#jobs" }, { label: "Schedule", href: "/workspace/crew#schedule" }];
  return [{ label: "Overview", href: "/workspace/support" }, { label: "Assigned cases", href: "/workspace/support#cases" }];
}
