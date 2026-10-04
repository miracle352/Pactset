import { CaretDown, Gear, SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { PactsetAvatar } from "@/components/profile/pactset-avatar";
import { ThemeControl } from "@/components/theme/theme-control";
import type { AccountRole } from "@/lib/account";

const labels: Record<AccountRole, string> = { organizer: "Organizer", supplier: "Supplier", crew: "Crew", support: "Support" };

export function WorkspaceShell({ workspaceRole, account, nav, children }: { workspaceRole: AccountRole; account: { email: string; roles: AccountRole[]; profile: Record<string, unknown> | null }; nav: { label: string; href: string }[]; children: React.ReactNode }) {
  const displayName = typeof account.profile?.display_name === "string" && account.profile.display_name ? account.profile.display_name : account.email;
  return <main className="workspace-page account-workspace"><aside className="workspace-sidebar glass-panel"><BrandMark /><div className="role-identity"><PactsetAvatar size="small" label={displayName} seed={String(account.profile?.avatar_seed ?? "opal")} style={String(account.profile?.avatar_style ?? "orbit")} color={String(account.profile?.avatar_color ?? "indigo")} /><div><strong>{displayName}</strong><small>{labels[workspaceRole]} workspace</small></div></div><nav aria-label={`${labels[workspaceRole]} navigation`}>{nav.map((item, index) => <Link key={item.href} href={item.href} className={index === 0 ? "active" : ""}>{item.label}</Link>)}</nav><div className="workspace-account-links"><Link href="/settings"><Gear /> Profile and settings</Link><form action={signOut}><button type="submit"><SignOut /> Sign out</button></form></div></aside><div className="workspace-main"><header className="workspace-topbar"><div className="role-switcher"><span>Working as</span><details><summary>{labels[workspaceRole]} <CaretDown /></summary><div className="role-switcher-menu">{account.roles.map((membership) => <Link key={membership} href={`/workspace/${membership}`}>{labels[membership]}</Link>)}</div></details></div><ThemeControl /></header>{children}</div><nav className="bottom-nav glass-panel" aria-label={`${labels[workspaceRole]} mobile navigation`}>{nav.slice(0, 4).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav></main>;
}

export function WorkspaceHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="workspace-heading"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="context-state empty-state"><h3>{title}</h3><p>{body}</p>{action}</div>;
}
