import {
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { RolePathSelector } from "@/components/landing/role-path-selector";
import { MobilePlanAction } from "@/components/landing/mobile-plan-action";
import { SiteHeader } from "@/components/navigation/site-header";
import { PavilionScene } from "@/components/pavilion/pavilion-scene";

const story = [
  {
    number: "01",
    title: "Plan and book",
    copy: "Bring the venue, equipment, suppliers, and crew into one event-local plan. Compare real terms before anyone commits.",
  },
  {
    number: "02",
    title: "Prepare and review evidence",
    copy: "Give every participant a clear deadline. Providers submit private progress evidence; organizers review it or request corrections.",
  },
  {
    number: "03",
    title: "Approve milestone payments",
    copy: "Fund an agreement-bound Stellar Testnet escrow, approve completed work, and release only the accepted milestone amount.",
  },
];

export default function Home() {
  return (
    <main className="landing-page recovered-landing">
      <div className="pavilion-narrative">
        <PavilionScene />
        <section className="landing-hero" data-scene-stage="0" aria-labelledby="landing-title">
          <SiteHeader />
          <div className="hero-content">
            <div className="hero-copy">
              <p className="hero-kicker">Global event operations · Stellar Testnet</p>
              <h1 id="landing-title"><span>Every detail.</span><span>One shared plan.</span></h1>
              <p className="hero-lede">
                Book your venue, suppliers and crew. Review the work. Approve milestone payments on Stellar.
              </p>
              <div className="hero-actions" id="hero-actions">
                <Link className="button button-primary button-arrow" href="/auth/sign-up?role=organizer">
                  Plan an event <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="hero-demo-link" href="/demo">Explore demo</Link>
              </div>
              <p className="network-copy">Stellar Testnet only · Test assets have no monetary value.</p>
            </div>
            <a className="story-scroll-cue" href="#pactset-story">
              <span>Follow the plan</span><ArrowRight className="story-scroll-arrow" aria-hidden="true" />
            </a>
          </div>
        </section>

        <section id="pactset-story" className="story-reel" aria-label="How Pactset works">
          {story.map((beat, index) => (
            <section className="narrative-beat page-width" data-scene-stage={index + 1} key={beat.number}>
              <div className="narrative-rule"><span>{beat.number}</span><span>03</span></div>
              <div className="narrative-copy">
                <h2>{beat.title}</h2>
                <p>{beat.copy}</p>
                {index === 2 && <small><CheckCircle aria-hidden="true" /> Illustrative scene; financial states come from the confirmed Testnet ledger.</small>}
              </div>
            </section>
          ))}
        </section>
      </div>

      <section id="how-it-works" className="participation-section page-width" aria-labelledby="participation-title">
        <div className="participation-copy">
          <p className="kicker">One shared plan, distinct responsibilities</p>
          <h2 id="participation-title">Start with the work you do.</h2>
          <p>Organizers build and fund the plan. Suppliers manage services and bookings. Crew coordinate shifts, preparation, and evidence.</p>
          <Link className="text-link" href="/demo">Explore fictional sample data <ArrowRight aria-hidden="true" /></Link>
        </div>
        <RolePathSelector />
      </section>

      <aside className="testnet-boundary page-width">
        <strong>Stellar Testnet</strong>
        <p>Pactset test assets have no monetary value. The public demo is fictional; authenticated payment rehearsals show ledger evidence only after confirmation.</p>
      </aside>
      <footer className="site-footer page-width"><span>PACTSET</span><p>Global event operations on Stellar Testnet.</p><Link href="/demo">Explore demo</Link></footer>
      <MobilePlanAction />
    </main>
  );
}
