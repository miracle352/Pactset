import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Briefcase } from "@phosphor-icons/react/dist/ssr/Briefcase";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PactsetAvatar } from "@/components/profile/pactset-avatar";
import { SiteHeader } from "@/components/navigation/site-header";
import { getAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

type Review = { id: string; rating: number; body: string; response_body: string | null; created_at: string };
type Work = { agreement_id: string; provider_role: string; category: string; pricing_unit: string; completed_at: string };
type Portfolio = {
  user_id: string; display_name: string; avatar_seed: string; avatar_style: string; avatar_color: string;
  city: string | null; country_code: string | null; headline: string; bio: string;
  services: string[]; skills: string[]; pricing_units: string[]; availability_note: string;
  roles: string[]; reviews: Review[]; completed_work: Work[];
};

export const metadata: Metadata = { title: "Provider portfolio" };

export default async function ProviderPortfolioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activity?: string }> }) {
  const [{ id }, query, account] = await Promise.all([params, searchParams, getAccount()]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_provider_portfolio", { p_provider_id: id });
  if (error || !data) notFound();
  const portfolio = data as Portfolio;
  const activity = query.activity === "reviews" ? "reviews" : query.activity === "completed" ? "completed" : "all";
  const average = portfolio.reviews.length ? portfolio.reviews.reduce((sum, review) => sum + review.rating, 0) / portfolio.reviews.length : null;
  const returnHref = account?.userId === id ? "/settings#provider" : account ? "/workspace" : "/";
  return <main className="public-profile-page">
    <SiteHeader authenticated={Boolean(account)} />
    <div className="public-profile-shell">
      <Link className="back-link" href={returnHref}><ArrowLeft aria-hidden="true" /> {account?.userId === id ? "Back to profile settings" : account ? "Back to workspace" : "Back to Pactset"}</Link>
      <header className="public-profile-hero glass-panel">
        <PactsetAvatar size="large" label={portfolio.display_name} seed={portfolio.avatar_seed} style={portfolio.avatar_style} color={portfolio.avatar_color} />
        <div><p className="kicker">Public provider portfolio</p><h1>{portfolio.display_name}</h1><p className="profile-headline">{portfolio.headline || "Event services and crew work through Pactset."}</p><p>{[portfolio.city, portfolio.country_code].filter(Boolean).join(", ")} · {portfolio.roles.join(" & ")}</p></div>
        {average !== null && <strong className="rating-summary"><CheckCircle weight="fill" aria-hidden="true" /> {average.toFixed(1)} · {portfolio.reviews.length} verified</strong>}
      </header>
      <section className="public-profile-grid">
        <article className="workspace-section"><p className="kicker">About</p><h2>What they provide</h2><p>{portfolio.bio || "This provider has not added a public introduction yet."}</p><dl className="profile-facts"><div><dt>Services</dt><dd>{portfolio.services.join(", ") || "Not listed"}</dd></div><div><dt>Skills</dt><dd>{portfolio.skills.join(", ") || "Not listed"}</dd></div><div><dt>Pricing units</dt><dd>{portfolio.pricing_units.join(", ") || "Not listed"}</dd></div><div><dt>Availability</dt><dd>{portfolio.availability_note || "Ask through an eligible Pactset request"}</dd></div></dl></article>
        <article className="workspace-section"><p className="kicker">Verified activity</p><h2>Completed work and feedback</h2><nav className="profile-filters" aria-label="Filter public activity"><Link aria-current={activity === "all" ? "page" : undefined} href={`/providers/${id}`}>All</Link><Link aria-current={activity === "completed" ? "page" : undefined} href={`/providers/${id}?activity=completed`}>Completed work</Link><Link aria-current={activity === "reviews" ? "page" : undefined} href={`/providers/${id}?activity=reviews`}>Reviews</Link></nav>
          {(activity === "all" || activity === "completed") && <div className="profile-activity"><h3><Briefcase aria-hidden="true" /> Completed through Pactset</h3>{portfolio.completed_work.length ? <ol>{portfolio.completed_work.map((item) => <li key={item.agreement_id}><strong>{item.category || item.provider_role}</strong><span>{item.pricing_unit} · completed {new Date(item.completed_at).toLocaleDateString()}</span></li>)}</ol> : <p className="empty-inline">No confirmed completed bookings are public yet.</p>}</div>}
          {(activity === "all" || activity === "reviews") && <div className="profile-activity"><h3><CheckCircle aria-hidden="true" /> Eligible booking reviews</h3>{portfolio.reviews.length ? <ol>{portfolio.reviews.map((review) => <li key={review.id}><strong>{review.rating}/5</strong><p>{review.body}</p>{review.response_body && <small>Provider response: {review.response_body}</small>}</li>)}</ol> : <p className="empty-inline">No published reviews from completed bookings yet.</p>}</div>}
        </article>
      </section>
      <p className="testnet-note">Portfolio activity reflects eligible Pactset records. Private offers, messages, payment details, declines, and unresolved cases are never shown here.</p>
    </div>
  </main>;
}
