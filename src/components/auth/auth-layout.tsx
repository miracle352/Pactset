import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { AccountWalletBoundary } from "./auth-form";

export function AuthLayout({ title, intro, children, boundary = "account" }: { title: string; intro: string; children: React.ReactNode; boundary?: "account" | "recovery" }) {
  return <main className="auth-page page-width"><header className="simple-header"><BrandMark /><Link className="text-link" href="/auth/sign-in">Sign in</Link></header><div className="auth-grid"><section className="auth-intro"><Link href="/" className="button button-secondary auth-back"><ArrowLeft aria-hidden="true" /> Back to home</Link><h1>{title}</h1><p>{intro}</p>{boundary === "account" ? <AccountWalletBoundary /> : <aside className="account-boundary glass-panel"><strong>Use the newest recovery email.</strong><p>Recovery links are time-limited and single-use. If a link is missing, expired, or already used, return here and request another after the resend window.</p></aside>}</section>{children}</div></main>;
}
