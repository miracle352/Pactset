import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ArchitecturalLines } from "./architectural-lines";

const product = [["How it works", "/#how-it-works"], ["For your role", "/#roles"], ["Event preparation", "/#preparation"], ["Stellar payments", "/#payments"], ["Find work", "/auth/sign-up/supplier"]];
const account = [["Plan an event", "/auth/sign-up/organizer"], ["Sign in", "/auth/sign-in"], ["Profile settings", "/settings"], ["Wallet & payments", "/settings/wallet"]];

export function LandingFooter() {
  return (
    <footer className="pactset-footer">
      <ArchitecturalLines variant="footer" />
      <div className="pactset-footer-grid">
        <section className="pactset-footer-brand"><BrandMark /><p>One accountable place to plan the event, coordinate the work, and release Testnet milestone payments when the agreed work is approved.</p><p className="footer-testnet">Stellar Testnet only · Test assets have no monetary value.</p><Link className="footer-top" href="#page-top">Back to top <ArrowRight aria-hidden="true" /></Link></section>
        <nav className="footer-nav" aria-label="Product"><h2>Product</h2>{product.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
        <nav className="footer-nav" aria-label="Account"><h2>Account</h2>{account.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      </div>
      <div className="pactset-copyright">Copyright © {new Date().getFullYear()} Pactset. Development experience on Stellar Testnet.</div>
    </footer>
  );
}
