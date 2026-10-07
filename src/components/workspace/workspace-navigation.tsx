"use client";

import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { label: string; href: string };

function useLocationKey() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = () => setHash(globalThis.location.hash);
    update(); globalThis.addEventListener("hashchange", update);
    return () => globalThis.removeEventListener("hashchange", update);
  }, []);
  return `${pathname}${hash}`;
}

function active(item: Item, location: string) {
  if (item.href.includes("#")) return location === item.href;
  return location.split("#")[0] === item.href;
}

export function WorkspaceNavigation({ nav, label }: { nav: Item[]; label: string }) {
  const location = useLocationKey();
  return <nav aria-label={label}>{nav.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""} aria-current={active(item, location) ? "page" : undefined}>{item.label}</Link>)}</nav>;
}

export function MobileWorkspaceNavigation({ nav, label }: { nav: Item[]; label: string }) {
  const location = useLocationKey();
  const primary = nav.slice(0, 3); const remaining = nav.slice(3);
  return <nav className="bottom-nav glass-panel" aria-label={label}>{primary.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""} aria-current={active(item, location) ? "page" : undefined}>{item.label}</Link>)}<details className="mobile-more"><summary><DotsThree /><span>More</span></summary><div className="mobile-more-menu">{remaining.map((item) => <Link key={item.href} href={item.href} className={active(item, location) ? "active" : ""}>{item.label}</Link>)}<Link href="/settings/wallet">Wallet & payments</Link><Link href="/settings">Profile & settings</Link><Link href="/demo">Help · try sample event</Link></div></details></nav>;
}
