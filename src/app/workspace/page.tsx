import { redirect } from "next/navigation";
import { preferredWorkspaceRole, requireAccount } from "@/lib/account";

export default async function WorkspaceIndex() {
  const account = await requireAccount();
  if (typeof account.profile?.username !== "string" || !account.profile.username) redirect("/settings?onboarding=username");
  const role = await preferredWorkspaceRole(account);
  redirect(role ? `/workspace/${role}` : "/onboarding/account");
}
