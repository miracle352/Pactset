import { ArrowRight, Clock, CurrencyCircleDollar, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/events/event-form";
import { EventChangeWorkflow, type EventChange } from "@/components/events/event-change-workflow";
import { PactsetGoBuilder } from "@/components/pactset-go/bundle-controls";
import { RequestForm } from "@/components/events/request-form";
import { SplitFlapCountdown } from "@/components/time/split-flap-countdown";
import { EmptyState, WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { countries, testCurrencies, timezones } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";

type EscrowSummary = { id: string; status: string; contract_address: string };
type TeamAgreement = { id: string; scope: string; status: string; amount: number; currency: string; provider_role: string; provider: Array<{ display_name: string }> | { display_name: string } | null; agreement_escrows: EscrowSummary[] | EscrowSummary | null };
const providerName = (agreement: TeamAgreement) => (Array.isArray(agreement.provider) ? agreement.provider[0]?.display_name : agreement.provider?.display_name) || `${agreement.provider_role} provider`;
const agreementEscrow = (agreement: TeamAgreement) => Array.isArray(agreement.agreement_escrows) ? agreement.agreement_escrows[0] : agreement.agreement_escrows ?? undefined;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const account = await requireAccount("organizer"); const supabase = await createClient();
  const [{ data: event }, { data: requests }, agreementResult, changeResult, runtimeResult, walletResult] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).eq("organizer_id", account.userId).maybeSingle(),
    supabase.from("requests").select("id,title,status,provider_role,category").eq("event_id", id).order("created_at", { ascending: false }),
    supabase.from("agreements").select("id,scope,status,amount,currency,provider_role,provider:profiles!agreements_provider_id_fkey(display_name),agreement_escrows(id,status,contract_address),requests!inner(event_id)").eq("requests.event_id", id).order("created_at"),
    supabase.from("event_change_requests").select("id,version,change_type,reason,prior_values,proposed_values,status,created_at,event_change_impacts(id,agreement_id,agreement_version,response,response_reason,proposed_implications)").eq("event_id", id).order("version", { ascending: false }),
    supabase.from("pactset_go_runtime_registry").select("id").eq("network","TESTNET").eq("active",true).maybeSingle(),
    supabase.from("wallet_connections").select("public_key,network,wallet_provider,verified_at").eq("user_id",account.userId).eq("network","TESTNET").eq("active",true).maybeSingle(),
  ]);
  if (!event) notFound();
  const team = (agreementResult.data ?? []) as unknown as TeamAgreement[];
  const published = requests?.filter((request) => request.status === "published").length ?? 0;
  const nextAction = !requests?.length ? { title: "Publish the first provider request", body: "Turn the event brief into a venue, supplier, or crew request.", href: "#new-request" } : published ? { title: "Review incoming offers", body: `${published} published request${published === 1 ? " is" : "s are"} open for provider responses.`, href: "/workspace/organizer#offers" } : { title: "Review accepted bookings", body: "Open an agreement to verify wallets, funding, evidence, and the next accountable action.", href: "/workspace/organizer#agreements" };
  return <WorkspaceShell workspaceRole="organizer" account={account} nav={[{ label: "Workspace", href: "/workspace/organizer" }, { label: "Brief", href: "#event-brief" }, { label: "Team", href: "#event-team" }, { label: "Requests", href: "#event-requests" }]}>
    <WorkspaceHeading eyebrow="Event plan" title={event.name || "Untitled event"} description={`${event.city}, ${event.timezone}. Every displayed event time uses this named timezone.`} />
    <section className="next-step event-next-step"><Clock /><div><p>Next action</p><h2>{nextAction.title}</h2><span>{nextAction.body}</span></div><Link href={nextAction.href}>Continue <ArrowRight /></Link></section>
    <SplitFlapCountdown targetIso={event.preparation_deadline} timezone={event.timezone} />
    <section id="event-brief" className="workspace-section event-brief"><div className="compact-section-heading"><div><p className="kicker">Event brief</p><h2>What the team is planning around</h2></div><UsersThree /></div><dl><div><dt>Attendance</dt><dd>{event.attendee_count ?? "Not set"} guests · {event.venue_capacity ?? "—"} capacity</dd></div><div><dt>Budget</dt><dd>{event.budget_currency} · {event.contingency_amount} contingency</dd></div><div><dt>Venue</dt><dd>{event.venue_address || event.city || "Not set"}</dd></div><div><dt>Preparation</dt><dd>{event.preparation_deadline ? new Date(event.preparation_deadline).toLocaleString("en", { timeZone: event.timezone, timeZoneName: "short" }) : "Not set"}</dd></div></dl><div className="brief-columns"><div><h3>Spaces</h3><p>{Array.isArray(event.spaces) && event.spaces.length ? event.spaces.join(" · ") : "No spaces listed"}</p><h3>Accessibility and timing</h3><p>{event.event_type || "Event type not set"} · {event.timezone}</p></div><div><h3>Food</h3><p>{Array.isArray(event.food_requirements) && event.food_requirements.length ? event.food_requirements.join(" · ") : "No food requirements listed"}</p><h3>Equipment and crew</h3><p>{Array.isArray(event.crew_requirements) && event.crew_requirements.length ? event.crew_requirements.join(" · ") : "No crew requirements listed"}</p></div></div></section>
    <section id="event-team" className="workspace-section"><div className="compact-section-heading"><div><p className="kicker">Event team</p><h2>Named providers and booking state</h2></div><CurrencyCircleDollar /></div>{team.length ? <div className="record-list">{team.map((agreement) => { const escrow = agreementEscrow(agreement); return <Link href={`/workspace/agreements/${agreement.id}/payment`} key={agreement.id}><div><strong>{providerName(agreement)}</strong><p>{agreement.scope} · {agreement.amount} {agreement.currency}</p></div><span>{(escrow?.status ?? agreement.status).replaceAll("_", " ")}</span><ArrowRight /></Link>; })}</div> : <EmptyState title="No accepted event team yet" body="Published requests and mutually accepted current offers create the named team. A draft or submitted offer is not a booking." />}</section>
    {!changeResult.error && <EventChangeWorkflow eventId={id} timezone={event.timezone} changes={(changeResult.data ?? []) as unknown as EventChange[]} />}
    {!runtimeResult.error && <PactsetGoBuilder eventId={id} timezone={event.timezone} wallet={walletResult.data} runtimeReady={Boolean(runtimeResult.data)} candidates={team.map((agreement)=>{const escrow=agreementEscrow(agreement);return {id:agreement.id,provider:providerName(agreement),scope:agreement.scope,amount:agreement.amount,currency:agreement.currency,escrowStatus:escrow?.status??"not created",eligible:escrow?.status==="awaiting_funding"};})}/>}
    <div id="event-details"><EventForm event={event} countries={countries} timezones={timezones()} currencies={testCurrencies()} /></div>
    <section id="event-requests" className="workspace-section"><div className="compact-section-heading"><h2>Requests from this event</h2></div>{requests?.length ? <div className="record-list">{requests.map((request) => <Link href={`/workspace/organizer/requests/${request.id}`} key={request.id}><div><strong>{request.title}</strong><p>{request.category} · {request.provider_role}</p></div><span>{request.status}</span></Link>)}</div> : <EmptyState title="No provider requests" body="A request publishes only the scope and work terms entered below, not the private event draft." />}</section>
    <div id="new-request"><RequestForm event={event} /></div>
  </WorkspaceShell>;
}
