import Link from "next/link";
import { EventForm } from "@/components/events/event-form";
import { WorkspaceHeading, WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireAccount } from "@/lib/account";
import { countries, timezones } from "@/lib/regions";

export default async function NewEventPage() { const account = await requireAccount("organizer"); return <WorkspaceShell workspaceRole="organizer" account={account} nav={[{ label: "Workspace", href: "/workspace/organizer" }, { label: "New event", href: "/workspace/organizer/events/new" }]}><WorkspaceHeading eyebrow="Private draft" title="Plan an event" description="Save now, sign out, and resume later without publishing private details." action={<Link className="button button-secondary" href="/workspace/organizer">Cancel</Link>} /><EventForm countries={countries} timezones={timezones()} /></WorkspaceShell>; }
