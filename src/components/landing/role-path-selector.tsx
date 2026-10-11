"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";

const paths = [
  { id: "organize", label: "Organizer", copy: "Shape the brief, align contributors, and approve the next move.", action: "Plan an event", href: "/auth/sign-up/organizer?next=%2Fworkspace%2Forganizer%2Fevents%2Fnew" },
  { id: "supply", label: "Supplier", copy: "Set availability, agree scope, and keep delivery requirements clear.", action: "Offer services", href: "/auth/sign-up/supplier?next=%2Fworkspace%2Fsupplier%23opportunities" },
  { id: "crew", label: "Crew", copy: "See shifts, preparation notes, due work, and evidence expectations.", action: "Find crew work", href: "/auth/sign-up/crew?next=%2Fworkspace%2Fcrew%23opportunities" },
] as const;

export function RolePathSelector() {
  const [selected, setSelected] = useState<(typeof paths)[number]["id"]>("organize");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = paths.find((path) => path.id === selected) ?? paths[0];

  const selectAt = (index: number) => {
    const path = paths[index];
    if (!path) return;
    setSelected(path.id);
    tabs.current[index]?.focus();
  };

  return (
    <section className="role-path glass-panel" aria-labelledby="role-path-title">
      <h2 id="role-path-title">How are you taking part?</h2>
      <div className="role-tabs" role="tablist" aria-label="Choose a Pactset role">
        {paths.map((path, index) => (
          <button
            key={path.id}
            ref={(element) => { tabs.current[index] = element; }}
            id={`role-tab-${path.id}`}
            type="button"
            role="tab"
            aria-selected={selected === path.id}
            aria-controls="role-path-panel"
            tabIndex={selected === path.id ? 0 : -1}
            onClick={() => setSelected(path.id)}
            onKeyDown={(event) => {
              const current = paths.findIndex((item) => item.id === selected);
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                selectAt((current + 1) % paths.length);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                selectAt((current - 1 + paths.length) % paths.length);
              }
              if (event.key === "Home") {
                event.preventDefault();
                selectAt(0);
              }
              if (event.key === "End") {
                event.preventDefault();
                selectAt(paths.length - 1);
              }
            }}
          >
            {path.label}
          </button>
        ))}
      </div>
      <div id="role-path-panel" className="role-path-panel" role="tabpanel" aria-labelledby={`role-tab-${active.id}`}>
        <p>{active.copy}</p>
        <Link href={active.href}>{active.action} <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
