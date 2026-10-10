"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const chapters = [
  { id: "story", label: "Plan" },
  { id: "roles", label: "Book" },
  { id: "preparation", label: "Prepare" },
  { id: "review", label: "Review" },
  { id: "payments", label: "Pay" },
  { id: "ready", label: "Ready" },
] as const;

export function LandingChapterNav() {
  const [active, setActive] = useState<(typeof chapters)[number]["id"]>("story");

  useEffect(() => {
    const sections = chapters.map(({ id }) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id as (typeof chapters)[number]["id"]);
    }, { rootMargin: "-24% 0px -60%", threshold: [0, .2, .55] });
    sections.forEach((section) => { observer.observe(section); });
    return () => observer.disconnect();
  }, []);

  const activeIndex = Math.max(0, chapters.findIndex((chapter) => chapter.id === active));
  return <nav className="landing-chapters" aria-label="Landing page chapters">
    <div className="chapter-track" aria-hidden="true"><span style={{ transform: `scaleX(${(activeIndex + 1) / chapters.length})` }} /></div>
    <ol>{chapters.map((chapter, index) => <li key={chapter.id}><Link href={`/#${chapter.id}`} aria-current={active === chapter.id ? "location" : undefined}><span>{String(index + 1).padStart(2, "0")}</span>{chapter.label}</Link></li>)}</ol>
  </nav>;
}
