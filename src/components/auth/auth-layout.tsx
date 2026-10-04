import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeControl } from "@/components/theme/theme-control";
import { AccountWalletBoundary } from "./auth-form";

export function AuthLayout({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <main className="auth-page page-width"><header className="simple-header"><BrandMark /><ThemeControl /></header><div className="auth-grid"><section className="auth-intro"><Link href="/" className="back-link">Pactset home</Link><h1>{title}</h1><p>{intro}</p><AccountWalletBoundary /></section>{children}</div></main>;
}
