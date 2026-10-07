export const dynamic = "force-dynamic";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { defaultWorkspaceNav, preferredWorkspaceRole, requireAccount } from "@/lib/account";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  const role = await preferredWorkspaceRole(account);
  if (!role) return children;
  return <WorkspaceShell workspaceRole={role} account={account} nav={defaultWorkspaceNav(role)}>{children}</WorkspaceShell>;
}
