"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roles", label: "For your role" },
];

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.dataset.menuOpen = String(open);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      delete document.documentElement.dataset.menuOpen;
    };
  }, [open]);

  return (
    <header className="site-header glass-panel">
      <BrandMark />
      <nav className="desktop-nav" aria-label="Primary navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link className="header-sign-in" href={authenticated ? "/workspace" : "/auth/sign-in"}>{authenticated ? "Open workspace" : "Sign in"}</Link>
        <Link className="button button-primary header-plan" href={authenticated ? "/workspace" : "/auth/sign-up?role=organizer"}>{authenticated ? "Open workspace" : "Plan an event"}</Link>
        <button className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={21} /> : <List size={21} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" className="mobile-menu glass-panel" aria-label="Mobile navigation">
          {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <Link href={authenticated ? "/workspace" : "/auth/sign-in"} onClick={() => setOpen(false)}>{authenticated ? "Open workspace" : "Sign in"}</Link>
          {!authenticated && <><Link href="/auth/sign-up?role=organizer" onClick={() => setOpen(false)}>Plan an event</Link><Link href="/onboarding" onClick={() => setOpen(false)}>Find work</Link></>}
        </nav>
      )}
    </header>
  );
}
