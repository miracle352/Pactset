import { CalendarCheck, CheckCircle, MapPin, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

const content = {
  organizer: {
    eyebrow: "Organizer account",
    title: "Start with the event, not the paperwork.",
    intro: "Create a private workspace now. Add the event location, timezone, team context, and budget progressively when you begin the plan.",
    next: "/workspace/organizer/events/new",
    points: [[CalendarCheck, "Create and resume event drafts"], [MapPin, "Keep location and event timezone explicit"], [CheckCircle, "Approve work and eligible milestones"]],
  },
  supplier: {
    eyebrow: "Supplier account",
    title: "Turn your services into clear bookings.",
    intro: "Create your account now. Add services, working area, pricing units, capacity, and availability from your saved profile afterward.",
    next: "/workspace/supplier#opportunities",
    points: [[Wrench, "Publish services and inventory"], [MapPin, "Set an approximate working area"], [CheckCircle, "Manage offers, bookings, and evidence"]],
  },
  crew: {
    eyebrow: "Crew account",
    title: "Keep every shift and hand-off visible.",
    intro: "Create your account now. Add skills, working area, rates, and availability progressively from your private workspace.",
    next: "/workspace/crew#opportunities",
    points: [[Wrench, "Add skills and pricing units"], [CalendarCheck, "Protect availability and avoid conflicts"], [CheckCircle, "Track preparation and required evidence"]],
  },
} as const;

export function RoleSignupPage({ signupRole, requestedNext }: { signupRole: keyof typeof content; requestedNext?: string }) {
  const item = content[signupRole];
  const next = requestedNext?.startsWith(`/workspace/${signupRole}`) ? requestedNext : item.next;
  return <AuthLayout title={item.title} intro={item.intro}>
    <div className="role-signup-stack">
      <div className="role-signup-context">
        <p className="kicker">{item.eyebrow}</p>
        <ul>{item.points.map(([Icon, label]) => <li key={label}><Icon aria-hidden="true" />{label}</li>)}</ul>
      </div>
      <AuthForm action={signUp} submitLabel="Create account" next={next} fields={[
        { name: "displayName", label: "Your or business name (optional)", autoComplete: "name", required: false },
        { name: "username", label: "Unique username", autoComplete: "username" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password (10 characters minimum)", type: "password", autoComplete: "new-password" },
        { name: "role", label: "Starting role", type: "hidden", defaultValue: signupRole },
      ]} footnote={<><Link href={`/onboarding?next=${encodeURIComponent(next)}`}>Change role</Link><span>Support access is assigned by Pactset. Already registered? <Link href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></span></>} />
    </div>
  </AuthLayout>;
}
