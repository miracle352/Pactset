import { CaretDown, CurrencyCircleDollar, Gear, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { PactsetAvatar } from "@/components/profile/pactset-avatar";
import { ThemeControl } from "@/components/theme/theme-control";
import type { AccountRole } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";
import { MobileWorkspaceNavigation, WorkspaceNavigation } from "@/components/workspace/workspace-navigation";

const labels: Record<AccountRole, string> = { organizer: "Organizer", supplier: "Supplier", crew: "Crew", support: "Support" };

export async function WorkspaceShell({ workspaceRole, account, nav, children }: { workspaceRole: AccountRole; account: { userId?: string; email: string; roles: AccountRole[]; profile: Record<string, unknown> | null }; nav: { label: string; href: string }[]; children: React.ReactNode }) {
  const displayName = typeof account.profile?.display_name === "string" && account.profile.display_name ? account.profile.display_name : account.email;
  const supabase = await createClient();
  const { data: wallet } = account.userId ? await supabase.from("wallet_connections").select("public_key").eq("user_id", account.userId).eq("network", "TESTNET").eq("active", true).maybeSingle() : { data: null };
  const navLabel = `${labels[workspaceRole]} navigation`;
  return <main className={`workspace-page account-workspace workspace-${workspaceRole}`}><aside className="workspace-sidebar glass-panel"><BrandMark /><div className="role-identity"><PactsetAvatar size="small" label={displayName} seed={String(account.profile?.avatar_seed ?? "opal")} style={String(account.profile?.avatar_style ?? "orbit")} color={String(account.profile?.avatar_color ?? "indigo")} /><div><strong>{displayName}</strong><small>{labels[workspaceRole]} workspace</small></div></div><WorkspaceNavigation nav={nav} label={navLabel} /><Link className="workspace-wallet-link" href="/settings/wallet"><CurrencyCircleDollar /> Wallet & payments <span>{wallet ? "Connected" : "Not connected"}</span></Link></aside><div className="workspace-main"><header className="workspace-topbar"><div className="role-switcher"><span>Working as</span><details><summary>{labels[workspaceRole]} <CaretDown /></summary><div className="role-switcher-menu">{account.roles.map((membership) => <Link key={membership} href={`/workspace/switch/${membership}?next=${encodeURIComponent(`/workspace/${membership}`)}`}>{labels[membership]}</Link>)}</div></details></div><div className="workspace-topbar-actions"><details className="account-menu"><summary aria-label="Account menu"><UserCircle /><span>Account</span><CaretDown /></summary><div className="account-menu-panel glass-panel"><Link href="/settings"><Gear /> Profile and settings</Link><Link href="/settings/wallet"><CurrencyCircleDollar /> Wallet & payments</Link><Link href="/demo">Help · try sample event</Link><form action={signOut}><button type="submit"><SignOut /> Sign out</button></form></div></details><ThemeControl /></div></header>{children}</div><MobileWorkspaceNavigation nav={nav} label={`${navLabel} on mobile`} /></main>;
}

export function WorkspaceHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="workspace-heading"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="context-state empty-state"><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function DataError({ title = "This section could not load" }: { title?: string }) {
  return <div className="context-state data-error" role="alert"><h3>{title}</h3><p>Pactset did not replace the failed request with an empty account. Refresh to try again; your saved records are unchanged.</p></div>;
}
