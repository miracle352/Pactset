import { ArrowRight, CalendarCheck, CheckCircle, CurrencyCircleDollar, Headset, LockSimple, MapPin, UsersThree, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ArchitecturalLines } from "@/components/landing/architectural-lines";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RolePathSelector } from "@/components/landing/role-path-selector";
import { SiteHeader } from "@/components/navigation/site-header";
import { getAccount } from "@/lib/account";

const journey = [
  { number: "01", title: "Book the right people", copy: "Publish a clear request, compare current offers, and accept one version of the scope, price, timing, and milestones." },
  { number: "02", title: "Prepare against one timeline", copy: "Keep venue access, equipment, food, crew shifts, preparation deadlines, and corrections tied to event-local time." },
  { number: "03", title: "Review the work", copy: "Suppliers and crew submit private progress evidence. Organizers approve it, request a correction, or open an assigned support case." },
  { number: "04", title: "Release the milestone", copy: "The organizer approves the agreed milestone and the confirmed Stellar Testnet ledger result becomes the payment record." },
];

const coordination = [
  { icon: MapPin, label: "Venue", copy: "Rooms, stages, access windows and capacity." },
  { icon: Wrench, label: "Equipment", copy: "Rental, purchase, quantity and overlapping availability." },
  { icon: CheckCircle, label: "Food", copy: "Requirements and approved event-day preparation exceptions." },
  { icon: UsersThree, label: "Crew", copy: "Skills, shifts, conflicts and accountable hand-offs." },
];

const paymentSteps = [
  ["Convert", "Review the exact local test asset, XLM maximum spend, illustrative rate, fee, slippage and quote expiry before signing."],
  ["Fund", "Move the agreed asset into an agreement-bound Soroban escrow. Conversion and funding remain separate, recoverable steps."],
  ["Approve", "Review submitted evidence or request a correction. A submission checkmark is not payment approval."],
  ["Release", "Release the accepted milestone once. Confirmed hashes link to the Stellar Testnet explorer."],
];

const faqs = [
  ["Is Pactset using real money?", "No. The current payment environment is Stellar Testnet. Pactset-issued test assets have no monetary value and the sandbox withdrawal is not a bank payout."],
  ["Do I need a wallet to plan an event?", "No. Your Pactset account manages identity, roles, drafts, requests and bookings. A separately verified Testnet wallet is needed only for wallet-authorized transactions."],
  ["Can support move any payment?", "No. Support sees only assigned cases, and a database role alone cannot move funds. On-chain resolution also requires the resolver wallet disclosed in the accepted escrow terms."],
  ["What happens when a plan changes?", "Current accepted terms remain active until affected parties accept a revision. Additional work or replacement funding stays separate from disputed or already-earned funds."],
];

export default async function Home() {
  const account = await getAccount();
  return (
    <main className="pactset-landing" id="page-top">
      <section className="pactset-hero" aria-labelledby="landing-title">
        <div className="hero-image" aria-hidden="true" /><div className="hero-overlay" aria-hidden="true" /><ArchitecturalLines variant="hero" /><SiteHeader authenticated={Boolean(account)} />
        <div className="pactset-hero-content page-width"><div className="pactset-hero-copy">
          <p className="editorial-kicker"><span />Global event operations · Stellar Testnet</p>
          <h1 id="landing-title">A thousand moving parts. <span>One seamless experience.</span></h1>
          <p className="hero-description">Bring your venue, suppliers and crew together. Track preparations, review the work, and approve milestone payments on Stellar.</p>
          <div className="hero-actions"><Link className="button button-primary button-arrow" href={account ? "/workspace" : "/auth/sign-up?role=organizer"}>{account ? "Open workspace" : "Plan an event"} <ArrowRight aria-hidden="true" /></Link><Link className="editorial-link" href={account ? "/workspace" : "/onboarding"}>{account ? "Continue your work" : "Find work"} <ArrowRight aria-hidden="true" /></Link></div>
          <p className="hero-boundary">Stellar Testnet · Test assets have no monetary value.</p>
        </div></div>
      </section>

      <section className="landing-section journey-section page-width" id="how-it-works" aria-labelledby="journey-title">
        <header className="editorial-heading"><p className="kicker">From brief to release</p><h2 id="journey-title">One event story, without the hand-off gaps.</h2><p>Pactset keeps the booking, preparation record, private evidence, approval, and payment state connected without pretending they are the same action.</p></header>
        <ol className="journey-rail">{journey.map((step) => <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}</ol>
      </section>

      <section className="landing-section roles-section" id="roles" aria-labelledby="roles-title"><div className="page-width roles-layout">
        <div className="roles-copy"><p className="kicker">A workspace shaped around your part</p><h2 id="roles-title">Different responsibilities. <em>One coordinated event.</em></h2><p>Organizers make the decisions. Suppliers manage services and inventory. Crew see the timing and proof expected from them. Assigned support enters only when a case requires it.</p></div>
        <RolePathSelector />
      </div></section>

      <section className="landing-section coordination-section page-width" aria-labelledby="coordination-title">
        <div className="coordination-visual" aria-hidden="true"><ArchitecturalLines /><span className="coordination-date">18<span>OCT</span></span><p>Event-local plan</p></div>
        <div className="coordination-copy"><p className="kicker">Event coordination</p><h2 id="coordination-title">See the dependencies before they become blockers.</h2><p>Small gatherings and large conferences both depend on clear capacity, ownership, timing, and accepted terms. Pactset keeps each operational detail attached to the event it affects.</p><div className="coordination-list">{coordination.map(({ icon: Icon, label, copy }) => <div key={label}><Icon aria-hidden="true" /><span><strong>{label}</strong><small>{copy}</small></span></div>)}</div></div>
      </section>

      <section className="landing-section payment-story" id="payments" aria-labelledby="payments-title"><ArchitecturalLines /><div className="page-width payment-story-grid">
        <header><p className="kicker">Stellar, with the states made clear</p><h2 id="payments-title">The money moves only when the right person signs.</h2><p>The agreement currency never changes silently. Wallet connection, signature, submission, confirmation and release are shown as distinct states.</p><span className="network-badge"><CurrencyCircleDollar aria-hidden="true" /> Stellar Testnet · no real value</span></header>
        <ol>{paymentSteps.map(([title, copy], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
      </div></section>

      <section className="landing-section change-section page-width" aria-labelledby="change-title">
        <div className="change-copy"><p className="kicker">When plans change</p><h2 id="change-title">Protect the work already done. Decide the next move visibly.</h2><p>Participants can open an assigned case with a reason and relevant evidence. Replacement discovery is planned; when available, it must match skill, area, availability, and budget—and use new approved funding rather than disputed funds.</p><div className="change-actions"><Link className="button button-secondary button-arrow" href={account ? "/workspace" : "/auth/sign-in"}>{account ? "Open your workspace" : "Sign in to continue"} <ArrowRight aria-hidden="true" /></Link></div></div>
        <ol className="support-sequence" aria-label="Support and replacement sequence"><li><CalendarCheck aria-hidden="true" /><strong>Record the change</strong><span>Reason, timing and affected terms</span></li><li><Headset aria-hidden="true" /><strong>Assign support</strong><span>Scoped access and an audit trail</span></li><li><LockSimple aria-hidden="true" /><strong>Resolve within the terms</strong><span>No reversal of completed transfers</span></li></ol>
      </section>

      <section className="landing-section faq-section page-width" aria-labelledby="faq-title"><header><p className="kicker">Practical answers</p><h2 id="faq-title">Know what Pactset does—and what it does not claim.</h2></header><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="final-cta" aria-labelledby="final-cta-title"><ArchitecturalLines /><div><p className="kicker">Start with the plan</p><h2 id="final-cta-title">Bring every decision into <em>one accountable view.</em></h2><p>Create the event, invite the right work, and keep every decision attached to the terms people accepted.</p><Link className="button button-gold button-arrow" href={account ? "/workspace" : "/auth/sign-up?role=organizer"}>{account ? "Open workspace" : "Plan an event"} <ArrowRight aria-hidden="true" /></Link></div></section>
      <LandingFooter />
    </main>
  );
}
