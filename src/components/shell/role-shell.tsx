import { ArrowLeft, ArrowRight, CircleNotch, LockSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";
import { StateShowcase } from "@/components/states/state-showcase";
import { ThemeControl } from "@/components/theme/theme-control";
import { type Role, roleContent } from "@/lib/product";

export function RoleShell({ workspaceRole }: { workspaceRole: Role }) {
  const content = roleContent[workspaceRole];
  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar glass-panel">
        <BrandMark />
        <div className="role-identity"><span className="avatar">{content.label.slice(0, 2).toUpperCase()}</span><div><strong>{content.label} view</strong><small>Fictional demo shell</small></div></div>
        <nav aria-label={`${content.label} navigation`}>{content.nav.map((item, index) => <a key={item} href={`#${item.toLowerCase()}`} className={index === 0 ? "active" : ""}>{item}<span>{String(index + 1).padStart(2, "0")}</span></a>)}</nav>
        <Link className="back-link" href="/demo"><ArrowLeft size={15} /> Demo index</Link>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar"><div><p className="kicker">{content.eyebrow}</p><span className="demo-chip">Fictional fixtures</span></div><ThemeControl /></header>
        <section className="workspace-hero">
          <div><h1>{content.title}</h1><p>{content.description}</p></div>
          <article className="focus-card glass-panel"><span className="pulse-dot" aria-hidden="true" /><p>Next focus</p><strong>{content.focus}</strong><button type="button" className="text-button" disabled>Open live record <LockSimple size={14} /></button></article>
        </section>
        <section className="metric-strip" aria-label="Fictional workspace summary">
          <div><span>Open decisions</span><strong>{workspaceRole === "support" ? "2" : "3"}</strong></div>
          <div><span>Next checkpoint</span><strong>{workspaceRole === "crew" ? "08:40" : "14 Oct"}</strong></div>
          <div><span>Network</span><strong>Testnet only</strong></div>
        </section>
        <section className="work-list glass-panel">
          <div className="section-heading"><div><p className="kicker">Preview queue</p><h2>What needs attention</h2></div><span className="fixture-label">Display only</span></div>
          {[
            ["Venue access", "Awaiting organizer confirmation", "Needs decision"],
            ["Lighting milestone", "Evidence review is unavailable in Stage 1", "Unavailable"],
            ["Final settlement", "No wallet, escrow, or balance is connected", "Stage 2"],
          ].map(([name, detail, status], index) => <article className="work-row" key={name}><span className="row-index">0{index + 1}</span><div><strong>{name}</strong><p>{detail}</p></div><span className="status-tag">{status}</span><ArrowRight size={17} /></article>)}
          <div className="loading-row"><CircleNotch size={17} className="spinner" /><span>Loading state preview</span></div>
        </section>
        <PreferencesPanel compact />
        <StateShowcase />
      </div>
      <nav className="bottom-nav glass-panel" aria-label={`${content.label} mobile navigation`}>{content.nav.slice(0, 4).map((item, index) => <a key={item} href={`#${item.toLowerCase()}`} className={index === 0 ? "active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{item}</a>)}</nav>
    </main>
  );
}
