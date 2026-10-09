import { BrandMark } from "@/components/brand/brand-mark";

export default function WorkspaceLoading() {
  return <main className="workspace-state-shell"><aside className="workspace-state-rail glass-panel"><BrandMark /><span /><span /><span /></aside><section className="workspace-state-content"><header className="workspace-state-header glass-panel"><span>Loading your authorized workspace</span></header><div className="workspace-state-card financial-surface" role="status"><p className="kicker">Pactset</p><h1>Preparing your workspace</h1><p>Your account, role and saved records are being checked. No action has been submitted.</p><div className="skeleton-lines"><span /><span /><span /></div></div></section></main>;
}
