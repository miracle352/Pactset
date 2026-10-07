import { ArrowRight, CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EmptyState, WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

function agreementStatus(agreement: { status: string; agreement_escrows?: { status: string } | { status: string }[] | null }) {
  const escrow = Array.isArray(agreement.agreement_escrows) ? agreement.agreement_escrows[0] : agreement.agreement_escrows;
  return (escrow?.status ?? agreement.status).replaceAll("_", " ");
}

export default async function OrganizerWorkspace() {
  const account = await requireAccount("organizer");
  const supabase = await createClient();
  const [{ data: events }, { data: requests }, { data: offers }, { data: agreements }, { count: draftCount }, { count: publishedCount }, { count: pendingOfferCount }] = await Promise.all([
    supabase.from("events").select("id,name,event_type,status,city,timezone,starts_at,updated_at").order("updated_at", { ascending: false }).limit(8),
    supabase.from("requests").select("id,title,status,event_id,provider_role,updated_at").order("updated_at", { ascending: false }).limit(8),
    supabase.from("offers").select("id,status,current_version,request_id,updated_at").order("updated_at", { ascending: false }).limit(8),
    supabase.from("agreements").select("id,scope,status,amount,currency,starts_at,provider_role,agreement_escrows(status)").order("created_at", { ascending: false }).limit(8),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("offers").select("id", { count: "exact", head: true }).in("status", ["submitted", "countered"]),
  ]);
  const nav = [
    { label: "Overview", href: "/workspace/organizer" },
    { label: "Events", href: "/workspace/organizer/events" },
    { label: "Requests", href: "/workspace/organizer#requests" },
    { label: "Offers", href: "/workspace/organizer#offers" },
    { label: "Agreements", href: "/workspace/organizer#agreements" },
  ];

  return (
    <WorkspaceShell workspaceRole="organizer" account={account} nav={nav}>
      <WorkspaceHeading eyebrow="Organizer" title="Your event desk" description="Resume plans, publish provider requests, and decide on current offers." action={<Link className="button button-primary" href="/workspace/organizer/events/new"><CalendarPlus /> New event</Link>} />
      <section className="workspace-summary" aria-label="Organizer summary">
        <article><span>Drafts</span><strong>{draftCount ?? "—"}</strong></article>
        <article><span>Published requests</span><strong>{publishedCount ?? "—"}</strong></article>
        <article><span>Pending offers</span><strong>{pendingOfferCount ?? "—"}</strong></article>
      </section>
      <section id="events" className="workspace-section">
        <div className="compact-section-heading"><h2>Events and drafts</h2><Link href="/workspace/organizer/events">View all</Link></div>
        {events?.length ? <div className="record-list">{events.map((event) => <Link href={`/workspace/organizer/events/${event.id}`} key={event.id}><div><strong>{event.name || "Untitled event"}</strong><p>{event.city || "Location needed"} · {event.timezone}</p></div><span>{event.status}</span><ArrowRight /></Link>)}</div> : <EmptyState title="Start with an event draft" body="Add the date, place, capacity, requirements, and budget. Drafts are private until you publish a provider request." action={<Link href="/workspace/organizer/events/new">Create an event</Link>} />}
      </section>
      <section id="requests" className="workspace-section">
        <div className="compact-section-heading"><h2>Provider requests</h2></div>
        {requests?.length ? <div className="record-list">{requests.map((request) => <Link href={`/workspace/organizer/requests/${request.id}`} key={request.id}><div><strong>{request.title}</strong><p>{request.provider_role} request</p></div><span>{request.status}</span><ArrowRight /></Link>)}</div> : <EmptyState title="No requests yet" body="Open an event and publish a clear supplier or crew request when the plan is ready." />}
      </section>
      <section id="offers" className="workspace-section">
        <div className="compact-section-heading"><h2>Incoming offers</h2></div>
        {offers?.length ? <div className="record-list">{offers.map((offer) => <Link href={`/workspace/offers/${offer.id}`} key={offer.id}><div><strong>Offer version {offer.current_version}</strong><p>Open the current terms before responding.</p></div><span>{offer.status}</span><ArrowRight /></Link>)}</div> : <EmptyState title="No offers need a decision" body="Offers from eligible providers appear here after a request is published." />}
      </section>
      <section id="agreements" className="workspace-section">
        <div className="compact-section-heading"><h2>Accepted agreements</h2></div>
        {agreements?.length ? <div className="agreement-grid">{agreements.map((agreement) => <Link className="agreement-card-link operational-card" href={`/workspace/agreements/${agreement.id}/payment`} key={agreement.id}><span className="funding-status">{agreementStatus(agreement)}</span><h3>{agreement.scope}</h3><p>{agreement.amount} {agreement.currency} · {agreement.provider_role}</p><span className="agreement-link-label">Open wallet and payment details <ArrowRight /></span></Link>)}</div> : <EmptyState title="No accepted agreements" body="An agreement appears only after both parties accept the same current offer version." />}
      </section>
    </WorkspaceShell>
  );
}
