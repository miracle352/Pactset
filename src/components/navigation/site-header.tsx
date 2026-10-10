"use client";

import { CaretDown, CurrencyCircleDollar, List, SignOut, UserCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

const links = [
  { href: "/#story", label: "How it works" },
  { href: "/#roles", label: "For your role" },
  { href: "/#payments", label: "Payments" },
];

const signupPaths = [
  { href: "/auth/sign-up/organizer?next=%2Fworkspace%2Forganizer%2Fevents%2Fnew", label: "Organize an event", detail: "Plan, book, and approve work" },
  { href: "/auth/sign-up/supplier?next=%2Fworkspace%2Fsupplier%23opportunities", label: "Offer services", detail: "Publish capacity and respond" },
  { href: "/auth/sign-up/crew?next=%2Fworkspace%2Fcrew%23opportunities", label: "Join the crew", detail: "Add skills and find shifts" },
];

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.dataset.menuOpen = String(open);
    if (open) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("a,button")?.focus());
    } else document.body.style.removeProperty("overflow");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        for (const details of headerRef.current?.querySelectorAll("details[open]") ?? []) details.removeAttribute("open");
      }
      if (event.key === "Tab" && open && menuRef.current) {
        const items = [...menuRef.current.querySelectorAll<HTMLElement>("a,button")].filter((item) => !item.hasAttribute("disabled"));
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.removeProperty("overflow");
      delete document.documentElement.dataset.menuOpen;
    };
  }, [open]);

  return (
    <header ref={headerRef} className="site-header glass-panel">
      <BrandMark />
      <nav className="desktop-nav" aria-label="Primary navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        {authenticated ? <>
          <Link className="button button-primary header-plan" href="/workspace">Open workspace</Link>
          <DismissibleDetails className="landing-account-menu">
            <summary aria-label="Account menu"><UserCircle aria-hidden="true" /><CaretDown aria-hidden="true" /></summary>
            <div className="landing-account-panel glass-panel" data-lenis-prevent>
              <Link href="/settings">Profile and settings</Link>
              <Link href="/settings/wallet"><CurrencyCircleDollar aria-hidden="true" /> Wallet &amp; payments</Link>
              <form action={signOut}><button type="submit"><SignOut aria-hidden="true" /> Sign out</button></form>
            </div>
          </DismissibleDetails>
        </> : <>
          <Link className="header-sign-in" href="/auth/sign-in">Sign in</Link>
          <DismissibleDetails className="get-started-menu">
            <summary className="button button-primary header-plan">Get started <CaretDown aria-hidden="true" /></summary>
            <div className="get-started-panel glass-panel" data-lenis-prevent>
              {signupPaths.map((path) => <Link key={path.href} href={path.href}><strong>{path.label}</strong><span>{path.detail}</span></Link>)}
            </div>
          </DismissibleDetails>
        </>}
        <button ref={menuButtonRef} className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={21} /> : <List size={21} />}
        </button>
      </div>
      {open && (
        <><button className="mobile-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => { setOpen(false); menuButtonRef.current?.focus(); }} /><nav ref={menuRef} id="mobile-menu" className="mobile-menu glass-panel" aria-label="Mobile navigation">
          {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          {authenticated ? <><Link href="/workspace" onClick={() => setOpen(false)}>Open workspace</Link><Link href="/settings" onClick={() => setOpen(false)}>Profile and settings</Link><Link href="/settings/wallet" onClick={() => setOpen(false)}>Wallet &amp; payments</Link><form action={signOut}><button type="submit">Sign out</button></form></> : <><Link href="/auth/sign-in" onClick={() => setOpen(false)}>Sign in</Link><p className="mobile-menu-label">Get started</p>{signupPaths.map((path) => <Link key={path.href} href={path.href} onClick={() => setOpen(false)}>{path.label}</Link>)}</>}
        </nav></>
      )}
    </header>
  );
}
