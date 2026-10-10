"use client";

import { Briefcase } from "@phosphor-icons/react/dist/csr/Briefcase";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { ClipboardText } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree";
import { Folder } from "@phosphor-icons/react/dist/csr/Folder";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

type Item = { label: string; href: string };

function useLocationKey() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = () => setHash(globalThis.location.hash);
    update(); globalThis.addEventListener("hashchange", update);
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setHash(`#${visible.target.id}`);
    }, { rootMargin: "-18% 0px -62%", threshold: [0, .25, .6] });
    for (const section of sections) observer.observe(section);
    return () => { globalThis.removeEventListener("hashchange", update); observer.disconnect(); };
  }, []);
  return `${pathname}${hash}`;
}

function active(item: Item, location: string) {
  if (item.href.includes("#")) return location === item.href;
  return location.split("#")[0] === item.href;
}

function NavIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const Icon = normalized.includes("event") || normalized.includes("schedule") ? CalendarBlank
    : normalized.includes("request") || normalized.includes("case") ? ClipboardText
    : normalized.includes("offer") || normalized.includes("agreement") || normalized.includes("booking") ? Briefcase
    : normalized.includes("team") || normalized.includes("crew") ? Briefcase
    : normalized === "overview" || normalized === "workspace" ? Folder : Briefcase;
  return <Icon aria-hidden="true" />;
}

export function WorkspaceNavigation({ nav, label }: { nav: Item[]; label: string }) {
  const location = useLocationKey();
  return <nav aria-label={label}>{nav.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""} aria-current={active(item, location) ? "page" : undefined}>{item.label}</Link>)}</nav>;
}

export function MobileWorkspaceNavigation({ nav, label }: { nav: Item[]; label: string }) {
  const location = useLocationKey();
  const primary = nav.slice(0, 3); const remaining = nav.slice(3);
  return <nav className="bottom-nav glass-panel" aria-label={label}>{primary.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""} aria-current={active(item, location) ? "page" : undefined}><NavIcon label={item.label} /><span>{item.label}</span></Link>)}<DismissibleDetails className="mobile-more"><summary><DotsThree /><span>More</span></summary><div className="mobile-more-menu" data-lenis-prevent>{remaining.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""} aria-current={active(item, location) ? "page" : undefined}><NavIcon label={item.label} />{item.label}</Link>)}<Link href="/settings/wallet">Wallet &amp; payments</Link><Link href="/settings">Profile &amp; settings</Link></div></DismissibleDetails></nav>;
}
