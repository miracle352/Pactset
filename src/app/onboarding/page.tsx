import { ArrowLeft, ArrowRight, Check, Headset, UsersThree, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

const choices = [
  { name: "Organizer", icon: UsersThree, copy: "Create a real account, save event drafts, publish requests, and approve the decisions that move work forward.", href: "/auth/sign-up?role=organizer" },
  { name: "Supplier", icon: Wrench, copy: "Create a service profile, set availability, and respond to eligible event requests.", href: "/auth/sign-up?role=supplier" },
  { name: "Crew", icon: Check, copy: "Create a skills profile, find eligible shifts, and keep preparation and evidence requirements clear.", href: "/auth/sign-up?role=crew" },
];

export default function OnboardingPage() {
  return <main className="onboarding-page page-width"><header className="simple-header"><BrandMark /><Link className="text-link" href="/auth/sign-in">Sign in</Link></header><Link href="/" className="back-link"><ArrowLeft size={15} /> Home</Link><section className="onboarding-intro"><p className="kicker">Choose a starting workspace</p><h1>How will you take part?</h1><p>Create your account and start with an empty, private workspace. Country, language, timezone and currency preferences are configured independently after signup.</p></section><div className="role-choice-grid">{choices.map(({ name, icon: Icon, copy, href }) => <Link className="role-choice glass-panel" key={name} href={href}><Icon size={25} aria-hidden="true" /><h2>{name}</h2><p>{copy}</p><span className="role-choice-action">Start as {name.toLowerCase()} <ArrowRight className="role-choice-arrow" size={16} aria-hidden="true" /></span></Link>)}</div><aside className="support-boundary glass-panel"><Headset size={23} /><div><strong>Support is assigned, not self-selected.</strong><p>Privileged support access requires a server-side assignment to a real case. It is intentionally absent from public signup.</p></div></aside></main>;
}
