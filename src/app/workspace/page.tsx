import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

export default async function WorkspaceIndex() {
  const account = await requireAccount();
  redirect(account.roles.length ? `/workspace/${account.roles[0]}` : "/onboarding/account");
}
