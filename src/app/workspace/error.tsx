"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="workspace-state-shell"><aside className="workspace-state-rail glass-panel"><BrandMark /></aside><section className="workspace-state-content"><header className="workspace-state-header glass-panel"><Link href="/workspace">Back to workspace</Link><Link href="/settings">Account settings</Link></header><div className="workspace-state-card financial-surface" role="alert"><p className="kicker">Workspace unavailable</p><h1>This view could not be loaded.</h1><p>Pactset did not replace the failed request with an empty account. Your saved records and wallet approvals are unchanged.</p><div className="workspace-state-actions"><button type="button" className="button button-primary" onClick={reset}>Try again</button><Link className="button button-secondary" href="/workspace">Workspace home</Link></div></div></section></main>;
}
