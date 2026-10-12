import Link from "next/link";

function ArrowIcon({ direction = "left" }: { direction?: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={direction === "left" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
  </svg>;
}

export function AgreementUnavailable({ returnTo = "/workspace" }: { returnTo?: string }) {
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(returnTo)}`;

  return <main className="workspace-state-shell">
    <section className="workspace-state-content">
      <div className="workspace-state-card financial-surface">
        <p className="kicker">Agreement unavailable</p>
        <h1>This agreement is not available to this account.</h1>
        <p>It may belong to another participant, or the record may no longer be available. Pactset does not reveal private agreement details.</p>
        <div className="workspace-state-actions">
          <Link className="button button-primary" href="/workspace"><ArrowIcon /> Back to workspace</Link>
          <Link className="button button-secondary" href={signInHref}>Sign in with another account <ArrowIcon direction="right" /></Link>
        </div>
      </div>
    </section>
  </main>;
}
