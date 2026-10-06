import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EmptyState, WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

function bookingStatus(agreement: { status: string; agreement_escrows?: { status: string } | { status: string }[] | null }) {
  const escrow = Array.isArray(agreement.agreement_escrows) ? agreement.agreement_escrows[0] : agreement.agreement_escrows;
  return (escrow?.status ?? agreement.status).replaceAll("_", " ");
}

export default async function SupplierWorkspace() {
  const account = await requireAccount("supplier");
  const supabase = await createClient();
  const [{ data: inventory }, { data: feed }, { data: offers }, { data: agreements }] = await Promise.all([
    supabase.from("inventory_items").select("id,name,category,total_quantity,unit,active").order("name"),
    supabase.rpc("list_eligible_requests"),
    supabase.from("offers").select("id,status,current_version,request_id,updated_at").eq("provider_role", "supplier").order("updated_at", { ascending: false }),
    supabase.from("agreements").select("id,scope,status,amount,currency,starts_at,ends_at,quantity,agreement_escrows(status)").eq("provider_role", "supplier").order("starts_at"),
  ]);
  const nav = [
    { label: "Overview", href: "/workspace/supplier" },
    { label: "Inventory", href: "/workspace/supplier/inventory" },
    { label: "Requests", href: "/workspace/supplier#opportunities" },
    { label: "Offers", href: "/workspace/supplier#offers" },
    { label: "Bookings", href: "/workspace/supplier#bookings" },
  ];
  return <WorkspaceShell workspaceRole="supplier" account={account} nav={nav}>
    <WorkspaceHeading eyebrow="Supplier" title="Services and bookings" description="Set what you can provide, respond to matching work, and follow accepted bookings through payment." action={<Link className="button button-primary" href="/settings#provider"><Plus /> Add service</Link>} />
    <section id="inventory" className="workspace-section"><div className="compact-section-heading"><h2>Inventory capacity</h2><Link href="/workspace/supplier/inventory">Manage</Link></div>{inventory?.length ? <div className="capacity-grid">{inventory.map((item) => <article key={item.id}><div><strong>{item.name}</strong><p>{item.category}</p></div><span>{item.total_quantity} {item.unit}</span></article>)}</div> : <EmptyState title="Add bookable inventory" body="Quantities are checked across overlapping accepted bookings and temporary acceptance reservations." action={<Link href="/workspace/supplier/inventory">Add inventory</Link>} />}</section>
    <section id="opportunities" className="workspace-section"><div className="compact-section-heading"><h2>Relevant requests</h2></div>{feed?.length ? <div className="record-list">{feed.map((request: { id: string; title: string; category: string; quantity: number; quantity_unit: string }) => <Link href={`/workspace/requests/${request.id}`} key={request.id}><div><strong>{request.title}</strong><p>{request.category} · {request.quantity} {request.quantity_unit}</p></div><ArrowRight /></Link>)}</div> : <EmptyState title="No matching supplier requests" body="Complete your services and availability so matching published requests can appear here. Private organizer details stay hidden until an agreement allows access." action={<Link href="/settings#provider">Complete supplier profile</Link>} />}</section>
    <section id="offers" className="workspace-section"><div className="compact-section-heading"><h2>Your offers</h2></div>{offers?.length ? <div className="record-list">{offers.map((offer) => <Link href={`/workspace/offers/${offer.id}`} key={offer.id}><div><strong>Offer version {offer.current_version}</strong><p>Open the current shared terms before deciding.</p></div><span>{offer.status}</span><ArrowRight /></Link>)}</div> : <EmptyState title="No supplier offers" body="Open a relevant request to submit exact scope, quantity, price, and timing." />}</section>
    <section id="bookings" className="workspace-section"><div className="compact-section-heading"><h2>Accepted bookings</h2><Link href="/settings/wallet">Wallet setup</Link></div>{agreements?.length ? <div className="agreement-grid">{agreements.map((agreement) => <Link className="agreement-card-link operational-card" href={`/workspace/agreements/${agreement.id}/payment`} key={agreement.id}><span className="funding-status">{bookingStatus(agreement)}</span><h3>{agreement.scope}</h3><p>{agreement.quantity} units · {agreement.amount} {agreement.currency}</p><span className="agreement-link-label">Open wallet and payment details <ArrowRight /></span></Link>)}</div> : <EmptyState title="No accepted supplier bookings" body="Add services, open a matching request, send an offer, and accept the same current terms as the organizer. Private fixture agreements are never added to your account." action={<Link href="/settings/wallet">Verify a Testnet wallet</Link>} />}</section>
  </WorkspaceShell>;
}
