"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeControl } from "@/components/theme/theme-control";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/onboarding", label: "Plan an event" },
  { href: "/demo", label: "Demo" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
        <ThemeControl />
        <button className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={21} /> : <List size={21} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" className="mobile-menu glass-panel" aria-label="Mobile navigation">
          {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <Link href="/organizer" onClick={() => setOpen(false)}>Role workspaces</Link>
        </nav>
      )}
    </header>
  );
}
