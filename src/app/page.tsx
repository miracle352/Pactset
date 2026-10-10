import { ArrowRight, CalendarCheck, CheckCircle, CurrencyCircleDollar, Headset, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { FileImage } from "@phosphor-icons/react/dist/ssr/FileImage";
import Link from "next/link";
import { ArchitecturalLines } from "@/components/landing/architectural-lines";
import { ConnectedJourney } from "@/components/landing/connected-journey";
import { LandingChapterNav } from "@/components/landing/landing-chapter-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { PreparationTimeline } from "@/components/landing/preparation-timeline";
import { RolePathSelector } from "@/components/landing/role-path-selector";
import { SplitTextReveal } from "@/components/motion/split-text-reveal";
import { SiteHeader } from "@/components/navigation/site-header";
import { SpotlightSurface } from "@/components/ui/spotlight-surface";
import { getAccount } from "@/lib/account";

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
      <SiteHeader authenticated={Boolean(account)} />
      <LandingChapterNav />
      <section className="pactset-hero" aria-labelledby="landing-title">
        <div className="hero-image" aria-hidden="true" /><div className="hero-overlay" aria-hidden="true" /><ArchitecturalLines variant="hero" />
        <div className="pactset-hero-content page-width"><div className="pactset-hero-copy">
          <p className="editorial-kicker" data-motion-hero><span />Global event operations · Stellar Testnet</p>
          <SplitTextReveal as="h1" id="landing-title" text="A thousand moving parts." emphasis="One seamless experience." />
          <p className="hero-description" data-motion-hero data-copy-reveal>Plan events, book suppliers and crew, track preparation, and approve payments in one place.</p>
          <div className="hero-actions" data-motion-hero><Link className="button button-primary button-arrow" href={account ? "/workspace" : "/auth/sign-up/organizer?next=%2Fworkspace%2Forganizer%2Fevents%2Fnew"}>{account ? "Open workspace" : "Plan an event"} <ArrowRight aria-hidden="true" /></Link>{!account && <Link className="button button-quiet button-arrow" href="/onboarding">Find work <ArrowRight aria-hidden="true" /></Link>}</div>
          <div className="hero-boundary" data-motion-hero><strong>Payments powered by Stellar · Testnet</strong><span>Test assets have no real monetary value.</span></div>
        </div></div>
      </section>

      <section className="landing-section journey-section page-width" id="story" aria-labelledby="journey-title" data-motion-reveal>
        <header className="editorial-heading"><p className="kicker">How it works</p><SplitTextReveal id="journey-title" text="Plan. Book. Review work. Release payment." /><p data-copy-reveal>Pactset keeps the booking, preparation record, private evidence, approval, and payment state connected without pretending they are the same action.</p></header>
        <ConnectedJourney />
      </section>

      <section className="landing-section roles-section" id="roles" aria-labelledby="roles-title" data-motion-reveal><div className="page-width roles-layout">
        <div className="roles-copy"><p className="kicker">Choose your role</p><SplitTextReveal id="roles-title" text="Different responsibilities." emphasis="One coordinated event." /><p data-copy-reveal><strong>Organizers</strong> shape the event brief, compare offers, and approve eligible work.</p><p data-copy-reveal><strong>Suppliers and crew</strong> manage services, availability, bookings, preparation, and evidence. Assigned support enters only when a case requires it.</p></div>
        <SpotlightSurface className="roles-spotlight"><RolePathSelector /></SpotlightSurface>
      </div></section>

      <section className="landing-section coordination-section page-width" id="preparation" aria-labelledby="coordination-title" data-motion-reveal>
        <div className="coordination-copy"><p className="kicker">Event preparation</p><SplitTextReveal id="coordination-title" text="Keep every preparation connected." /><p data-copy-reveal>See who is doing what, when it is due, and what needs to happen first.</p></div>
        <SpotlightSurface className="coordination-visual" color="rgba(223, 161, 45, .12)"><PreparationTimeline /></SpotlightSurface>
      </section>

      <section className="landing-section evidence-story page-width" id="review" aria-labelledby="review-title" data-motion-reveal>
        <div className="evidence-story-copy"><p className="kicker">Evidence review</p><SplitTextReveal id="review-title" text="See the work." emphasis="Keep approval human." /><p data-copy-reveal>Suppliers and crew submit a note with optional private photo or video evidence. The organizer can request a correction or approve an eligible milestone; an upload alone never releases payment.</p></div>
        <figure className="evidence-story-visual glass-panel" aria-label="Illustrative evidence review sequence"><div><FileImage aria-hidden="true" /><span><small>Submitted evidence</small><strong>Setup photos and hand-off note</strong></span><em>Private</em></div><div><CheckCircle aria-hidden="true" /><span><small>Organizer decision</small><strong>Review, request correction, or approve</strong></span><em>Human action</em></div><p>Illustration only · no real evidence or payment status.</p></figure>
      </section>

      <section className="landing-section payment-story" id="payments" aria-labelledby="payments-title" data-motion-reveal><ArchitecturalLines /><div className="page-width payment-story-grid">
        <header><p className="kicker">Stellar payments</p><SplitTextReveal id="payments-title" text="The money moves only when the right person signs." /><p data-copy-reveal>The agreement currency never changes silently. Planned, converted, funded, approved, and released amounts remain distinct. Wallet connection, signature, submission, and confirmation are separate states.</p><span className="network-badge"><CurrencyCircleDollar aria-hidden="true" /> Stellar Testnet · no real value</span></header>
        <ol>{paymentSteps.map(([title, copy], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
      </div></section>

      <section className="landing-section change-section page-width" aria-labelledby="change-title" data-motion-reveal>
        <div className="change-copy"><p className="kicker">When plans change</p><SplitTextReveal id="change-title" text="Protect the work already done." emphasis="Decide the next move visibly." /><p data-copy-reveal>Participants can propose deadline and scope changes with a reason and an audit trail. Assigned support can review authorized cases. Replacement discovery remains planned and must use new approved funding rather than disputed funds.</p><div className="change-actions"><Link className="button button-secondary button-arrow" href={account ? "/workspace" : "/auth/sign-in"}>{account ? "Open your workspace" : "Sign in to continue"} <ArrowRight aria-hidden="true" /></Link></div></div>
        <ol className="support-sequence" aria-label="Support and replacement sequence"><li><CalendarCheck aria-hidden="true" /><strong>Record the change</strong><span>Reason, timing and affected terms</span></li><li><Headset aria-hidden="true" /><strong>Assign support</strong><span>Scoped access and an audit trail</span></li><li><LockSimple aria-hidden="true" /><strong>Resolve within the terms</strong><span>No reversal of completed transfers</span></li></ol>
      </section>

      <section className="landing-section faq-section page-width" aria-labelledby="faq-title" data-motion-reveal><header><p className="kicker">Practical answers</p><SplitTextReveal id="faq-title" text="Know what Pactset does—and what it does not claim." /></header><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="final-cta" id="ready" aria-labelledby="final-cta-title"><ArchitecturalLines /><div><p className="kicker">Ready for the next decision</p><SplitTextReveal id="final-cta-title" text="Bring every decision into" emphasis="one accountable view." /><p data-copy-reveal>Create the event, invite the right work, and keep every decision attached to the terms people accepted.</p><Link className="button button-gold button-arrow" href={account ? "/workspace" : "/auth/sign-up/organizer?next=%2Fworkspace%2Forganizer%2Fevents%2Fnew"}>{account ? "Open workspace" : "Plan an event"} <ArrowRight aria-hidden="true" /></Link></div></section>
      <LandingFooter />
    </main>
  );
}
