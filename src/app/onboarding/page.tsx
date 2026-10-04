import { ArrowLeft, ArrowRight, Check, Headset, UsersThree, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";
import { ThemeControl } from "@/components/theme/theme-control";

const choices = [
  { name: "Organizer", icon: UsersThree, copy: "Shape the event, assemble the team, and make the decisions that move work forward.", href: "/organizer" },
  { name: "Supplier", icon: Wrench, copy: "Offer a service, set availability, and agree clear scope before accepting work.", href: "/supplier" },
  { name: "Crew", icon: Check, copy: "See shifts, preparation, due work, and evidence expectations without the noise.", href: "/crew" },
];

export default function OnboardingPage() {
  return <main className="onboarding-page page-width"><header className="simple-header"><BrandMark /><ThemeControl /></header><Link href="/" className="back-link"><ArrowLeft size={15} /> Home</Link><section className="onboarding-intro"><p className="kicker">Choose a starting workspace</p><h1>How will you take part?</h1><p>Stage 1 previews each role with fictional data. Account creation and permissions begin in Stage 2.</p></section><div className="role-choice-grid">{choices.map(({ name, icon: Icon, copy, href }) => <article className="role-choice glass-panel" key={name}><Icon size={25} /><h2>{name}</h2><p>{copy}</p><Link href={href}>Preview {name.toLowerCase()} shell <ArrowRight size={16} /></Link></article>)}</div><aside className="support-boundary glass-panel"><Headset size={23} /><div><strong>Support is assigned, not self-selected.</strong><p>Privileged support access will require a server-side assignment. It is intentionally absent from public onboarding.</p></div><Link href="/support">Preview the fictional support shell</Link></aside><PreferencesPanel /></main>;
}
