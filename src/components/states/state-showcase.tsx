import { ArrowRight, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";

export function StateShowcase() {
  return (
    <section className="state-showcase" aria-labelledby="states-title">
      <div className="section-heading"><div><p className="kicker">System states</p><h2 id="states-title">Nothing hides behind a pretend success</h2></div></div>
      <div className="state-grid">
        <article className="state-card glass-panel"><div className="skeleton-lines" role="status" aria-label="Loading preview"><span /><span /><span /></div><h3>Loading</h3><p>The next view keeps its shape while data arrives.</p></article>
        <article className="state-card glass-panel"><span className="state-symbol"><Clock size={20} /></span><h3>Empty</h3><p>No accepted agreements yet. Publish a request when the event brief is ready.</p></article>
        <article className="state-card glass-panel"><span className="state-symbol state-error"><WarningCircle size={20} /></span><h3>Unavailable</h3><p>Wallet connection begins in Stage 2. No balance or payment has been simulated.</p><button type="button" className="text-button" disabled>Fund milestone <ArrowRight size={14} /></button></article>
      </div>
    </section>
  );
}
