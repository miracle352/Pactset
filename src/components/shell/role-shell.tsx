import { ArrowLeft, ArrowRight, LockSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { type Role, roleContent } from "@/lib/product";
import { getAccount } from "@/lib/account";

const demoSections: Record<Role, { id: string; title: string; copy: string; rows: [string, string, string][] }[]> = {
  organizer: [
    { id: "events", title: "Events and drafts", copy: "Private drafts and event-local timing would live here after sign-in.", rows: [["Harborlight Forum", "Valletta · 18 October", "Planning"], ["Winter rooms plan", "2 stages · 180 attendees", "Draft"]] },
    { id: "requests", title: "Requests and offers", copy: "Compare current provider terms without exposing private draft details.", rows: [["Pavilion lighting", "2 supplier offers", "Decision"], ["Sound crew", "Current terms version 2", "Review"]] },
    { id: "agreements", title: "Agreements", copy: "Accepted sample terms stay visibly unfunded.", rows: [["Venue access", "Accepted by both parties", "Awaiting Testnet funding"]] },
  ],
  supplier: [
    { id: "inventory", title: "Services and inventory", copy: "Track quantity-limited stock before accepting overlapping bookings.", rows: [["Pavilion structure", "1 of 2 available", "Available"], ["Lighting kits", "12 total units", "Capacity tracked"]] },
    { id: "requests", title: "Relevant requests", copy: "Published work appears without private organizer details.", rows: [["Pavilion lighting", "Valletta · 18 October", "Eligible"], ["Directional signage", "Purchase · 40 units", "Eligible"]] },
    { id: "bookings", title: "Offers and bookings", copy: "Revised terms invalidate older acceptance.", rows: [["Lighting offer", "Version 2", "Countered"], ["Pavilion booking", "Accepted sample", "Awaiting Testnet funding"]] },
  ],
  crew: [
    { id: "opportunities", title: "Opportunities", copy: "See role, preparation deadline, and shift window before offering.", rows: [["Sound technician", "08:40-17:30 event-local", "Eligible"], ["Stage hand", "Teardown ends 23:00", "Eligible"]] },
    { id: "schedule", title: "Schedule", copy: "Conflicting accepted shifts are blocked in the authenticated workspace.", rows: [["Venue access", "08:40", "Preparation"], ["Sound check", "09:30", "Upcoming"]] },
    { id: "jobs", title: "Accepted jobs", copy: "Work-start eligibility remains separate from payment funding.", rows: [["Sound technician", "Accepted sample", "Awaiting Testnet funding"]] },
  ],
  support: [
    { id: "assigned", title: "Assigned cases", copy: "Support accounts see only explicitly assigned cases.", rows: [] },
    { id: "boundary", title: "Access boundary", copy: "Public signup cannot grant support privileges. Dispute actions and private evidence are not implemented.", rows: [] },
  ],
};

export async function RoleShell({ workspaceRole }: { workspaceRole: Role }) {
  const content = roleContent[workspaceRole];
  const account = await getAccount();
  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar glass-panel">
        <BrandMark />
        <div className="role-identity"><span className="avatar">{content.label.slice(0, 2).toUpperCase()}</span><div><strong>{content.label} demo</strong><small>Fictional sample data</small></div></div>
        <nav aria-label={`${content.label} navigation`}>{demoSections[workspaceRole].map((item, index) => <a key={item.id} href={`#${item.id}`} className={index === 0 ? "active" : ""}>{item.title}</a>)}</nav>
        <Link className="back-link" href="/demo"><ArrowLeft size={15} /> Demo index</Link>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar"><div><p className="kicker">{content.eyebrow}</p><span className="demo-chip">Sample data · not your account</span></div><div>{account ? <Link className="button button-secondary" href="/workspace">Return to my workspace</Link> : <Link className="text-link" href="/auth/sign-in">Sign in</Link>}</div></header>
        <section className="workspace-hero">
          <div><h1>{content.title}</h1><p>{content.description}</p></div>
          <article className="focus-card glass-panel"><span className="pulse-dot" aria-hidden="true" /><p>Sample next focus</p><strong>{content.focus}</strong><Link className="text-link" href={`/auth/sign-up?role=${workspaceRole === "support" ? "organizer" : workspaceRole}`}>{workspaceRole === "support" ? "Sign in with assigned access" : "Create an account"}<ArrowRight size={14} /></Link></article>
        </section>
        <section className="metric-strip" aria-label="Fictional workspace summary">
          <div><span>Open decisions</span><strong>{workspaceRole === "support" ? "2" : "3"}</strong></div>
          <div><span>Next checkpoint</span><strong>{workspaceRole === "crew" ? "08:40" : "14 Oct"}</strong></div>
          <div><span>Network</span><strong>Testnet only</strong></div>
        </section>
        {demoSections[workspaceRole].map((section) => <section className="work-list glass-panel" id={section.id} key={section.id}><div className="section-heading"><div><h2>{section.title}</h2><p className="section-copy">{section.copy}</p></div><span className="fixture-label">Sample data</span></div>{section.rows.length ? section.rows.map(([name, detail, status]) => <article className="work-row" key={name}><div><strong>{name}</strong><p>{detail}</p></div><span className="status-tag">{status}</span><ArrowRight size={17} /></article>) : <div className="context-state empty-state"><LockSimple /><h3>Nothing assigned</h3><p>This demo does not grant privileged access or invent a support case.</p></div>}</section>)}
      </div>
      <nav className="bottom-nav glass-panel" aria-label={`${content.label} mobile navigation`}>{demoSections[workspaceRole].slice(0, 4).map((item) => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}</nav>
    </main>
  );
}
