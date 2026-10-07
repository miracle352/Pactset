import {
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  ClipboardText,
  CreditCard,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { RolePathSelector } from "@/components/landing/role-path-selector";
import { MobilePlanAction } from "@/components/landing/mobile-plan-action";
import { SiteHeader } from "@/components/navigation/site-header";
import { PavilionScene } from "@/components/pavilion/pavilion-scene";

const journey = [
  { title: "Book", copy: "Choose the right venue and suppliers.", icon: CalendarCheck },
  { title: "Prepare", copy: "Give every person a clear next action.", icon: ClipboardText },
  { title: "Approve", copy: "Review evidence before work moves on.", icon: CheckCircle },
  { title: "Pay", copy: "Preview when a test payment would be eligible.", icon: CreditCard },
];

export default function Home() {
  return (
    <main className="landing-page">
      <div className="cinematic-landing">
        <PavilionScene />
      <section className="landing-hero" data-scene-stage="0" aria-labelledby="landing-title">
        <SiteHeader />
        <div className="hero-content">
          <div className="hero-copy">
            <p className="hero-kicker">Global event operations on Stellar Testnet</p>
            <h1 id="landing-title"><span>Every detail.</span><span>One shared plan.</span></h1>
            <p className="hero-lede">
              Bring venues, suppliers, and crew into one clear plan from booking through approval.
            </p>
            <div className="hero-actions" id="hero-actions">
              <Link className="button button-primary" href="/auth/sign-up?role=organizer">
                Plan an event <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="hero-demo-link" href="/demo">Explore demo</Link>
            </div>
            <p className="network-copy">Fictional demo on Stellar Testnet. Test assets only.</p>
          </div>
          <RolePathSelector />
        </div>
      </section>

      <section className="journey-section story-beat page-width" data-scene-stage="1" aria-labelledby="journey-title">
        <div className="journey-intro">
          <h2 id="journey-title">One plan from booking to payment.</h2>
          <p>Everyone sees what is ready, what is blocked, and who needs to act next.</p>
        </div>
        <ol className="journey-sequence">
          {journey.map(({ title, copy, icon: Icon }) => (
            <li key={title}>
              <span className="journey-icon" aria-hidden="true"><Icon size={21} /></span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="how-it-works" className="explanation-section story-beat page-width" data-scene-stage="2">
        <div className="statement">
          <h2>Clear work for every role.</h2>
          <p>Organizers align the plan, suppliers confirm scope, and crew see exactly what to prepare and deliver.</p>
        </div>
        <div className="role-explanations">
          <article><UsersThree size={24} aria-hidden="true" /><h3>Organizers</h3><p>Build the event plan, compare offers, assign work, and approve the next step.</p><Link href="/organizer">See organizer demo <ArrowRight size={16} /></Link></article>
          <article><CalendarCheck size={24} aria-hidden="true" /><h3>Suppliers</h3><p>Share availability, agree scope, and keep delivery requirements visible.</p><Link href="/supplier">See supplier demo <ArrowRight size={16} /></Link></article>
          <article><ClipboardText size={24} aria-hidden="true" /><h3>Crew</h3><p>Find shifts, preparation notes, due work, and evidence expectations in one place.</p><Link href="/crew">See crew demo <ArrowRight size={16} /></Link></article>
        </div>
      </section>

      <section className="testnet-section story-beat page-width glass-panel" data-scene-stage="3">
        <div className="testnet-map"><MapPin size={22} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div>
        <div><h2>A clear Testnet boundary.</h2><p>Public demos use fictional sample data. Authenticated payment rehearsals use Pactset-issued Testnet assets with no real-world value and show real Testnet transaction evidence when confirmed.</p><Link className="text-link" href="/demo">See the fictional demo boundary <ArrowRight size={15} /></Link></div>
      </section>
      </div>
      <footer className="site-footer page-width"><span>PACTSET</span><p>Global event operations on Stellar Testnet.</p><Link href="/demo">Explore demo</Link></footer>
      <MobilePlanAction />
    </main>
  );
}
