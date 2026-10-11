import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

export default async function AccountOnboardingPage() {
  const account = await requireAccount();
  redirect(account.roles.length && typeof account.profile?.username === "string" && account.profile.username ? `/workspace/${account.roles[0]}` : "/settings?onboarding=account");
}
