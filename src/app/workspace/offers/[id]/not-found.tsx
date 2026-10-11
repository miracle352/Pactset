import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function OfferNotFound() {
  return <main className="workspace-state-shell"><section className="workspace-state-content"><div className="workspace-state-card financial-surface"><p className="kicker">Offer unavailable</p><h1>This offer is not available to this account.</h1><p>It may have expired, been removed from your history, or belong to a different participant. Pactset does not reveal private offer records.</p><div className="workspace-state-actions"><Link className="button button-primary" href="/workspace"><ArrowLeft /> Back to workspace</Link><Link className="button button-secondary" href="/settings">Account settings</Link></div></div></section></main>;
}
