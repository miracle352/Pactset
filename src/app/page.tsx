import { ArrowRight, CalendarCheck, CreditCard, MapPin, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PavilionScene } from "@/components/pavilion/pavilion-scene";
import { SiteHeader } from "@/components/navigation/site-header";

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <SiteHeader />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker">Global event operations · Stellar Testnet</p>
            <h1>Every detail.<br />One shared plan.</h1>
            <p className="hero-lede">Bring your venue, suppliers, and crew into one clear path from the first booking to the final approved test payment.</p>
            <div className="hero-actions"><Link className="button button-primary" href="/onboarding">Plan an event <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/demo">Explore the demo</Link></div>
            <p className="network-copy">Testnet only. No real money, live accounts, or verified providers are represented in Stage 1.</p>
          </div>
          <PavilionScene />
        </div>
        <section className="hero-utility glass-panel" aria-label="Pactset workflow preview">
          <span><UsersThree size={19} /> Book your team</span><span><CalendarCheck size={19} /> Track the work</span><span><CreditCard size={19} /> Pay on approval</span><small>Global events · Named timezones · Test assets</small>
        </section>
      </section>

      <section id="how-it-works" className="explanation-section page-width">
        <div className="statement"><p className="kicker">One operational thread</p><h2>Clarity before commitment.</h2><p>Pactset is designed to make dependencies, agreements, evidence, and approvals legible to every participant. AI may prepare an action, but people approve commitments and money movement.</p></div>
        <div className="process-list">
          {[["01", "Venue", "Capture access, rooms, stages, equipment, food, transport, and the constraints that shape a real plan."], ["02", "Crew", "Coordinate suppliers and crew around accepted scope, named timezones, dependencies, and visible next actions."], ["03", "Milestones", "Fund and release eligible milestones on Stellar Testnet only after explicit human approval."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={18} /></article>)}
        </div>
      </section>

      <section className="testnet-section page-width glass-panel">
        <div className="testnet-map"><MapPin size={22} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div>
        <div><p className="kicker">What Stellar does here</p><h2>Test settlement with visible boundaries.</h2><p>Later stages will use Stellar Testnet for issued test assets, conversion, escrow funding, and ledger-confirmed releases. TUSD, TGBP, and TAUD are Pactset demonstration assets, not real fiat or guaranteed-redeemable stablecoins.</p><Link className="text-link" href="/demo">See the fictional demo boundary <ArrowRight size={15} /></Link></div>
      </section>
      <footer className="site-footer page-width"><span>PACTSET</span><p>Working brand. No claim of legal clearance.</p><Link href="/demo">Open demo</Link></footer>
    </main>
  );
}
