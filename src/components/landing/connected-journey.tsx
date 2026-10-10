"use client";

import { useGSAP } from "@gsap/react";
import { Briefcase } from "@phosphor-icons/react/dist/csr/Briefcase";
import { CalendarCheck } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ClipboardText } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CurrencyCircleDollar } from "@phosphor-icons/react/dist/csr/CurrencyCircleDollar";
import { FileImage } from "@phosphor-icons/react/dist/csr/FileImage";
import gsap from "gsap";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

const stages = [
  { id: "plan", label: "Plan", icon: ClipboardText, title: "Start with one accountable brief", copy: "Set the location, event timezone, attendance, venue needs, food, equipment, crew, and an editable budget before asking anyone to commit.", facts: ["Lagos · Africa/Lagos", "240 attendees", "TGBP planning currency"] },
  { id: "book", label: "Book", icon: Briefcase, title: "Bring the right work into the plan", copy: "Publish privacy-safe requests, compare current offers, and accept only the same version of scope, price, timing, and milestones.", facts: ["Venue access", "Sound supplier", "Two crew shifts"] },
  { id: "prepare", label: "Prepare", icon: CalendarCheck, title: "Make dependencies and deadlines visible", copy: "Venue access leads equipment setup; crew checks follow; food may use the explicit event-morning exception.", facts: ["17 OCT deadline", "Dependencies linked", "Named owner per task"] },
  { id: "review", label: "Review", icon: FileImage, title: "Review evidence before approving work", copy: "Providers submit private notes, photos, or video. Organizers may request a correction without erasing the earlier submission.", facts: ["Private evidence", "Correction history", "Human approval"] },
  { id: "pay", label: "Pay", icon: CurrencyCircleDollar, title: "Keep conversion, escrow, and release distinct", copy: "The organizer reviews an exact Testnet quote, funds the accepted asset, then separately approves an eligible milestone release.", facts: ["Exact asset + issuer", "Agreement-bound escrow", "Ledger confirmation"] },
  { id: "ready", label: "Ready", icon: CheckCircle, title: "Settle into a clear preparation view", copy: "The overview shows what is complete, what is blocked, who acts next, and which payment state is confirmed—without treating illustration as live data.", facts: ["Next action visible", "Blockers named", "Testnet status explicit"] },
] as const;

export function ConnectedJourney() {
  const [selected, setSelected] = useState<(typeof stages)[number]["id"]>("plan");
  const root = useRef<HTMLDivElement>(null);
  const stage = stages.find((item) => item.id === selected) ?? stages[0];
  const activeIndex = stages.findIndex((item) => item.id === stage.id);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo("[data-journey-copy]", { opacity: .45, y: 14 }, { opacity: 1, y: 0, duration: .38, ease: "power3.out", clearProps: "transform,opacity" });
    gsap.fromTo("[data-journey-fact]", { opacity: .4, y: 10 }, { opacity: 1, y: 0, duration: .34, stagger: .045, ease: "power2.out", clearProps: "transform,opacity" });
  }, { scope: root, dependencies: [selected], revertOnUpdate: true });

  return <div ref={root} className="connected-journey glass-panel">
    <div className="journey-stage-tabs" role="tablist" aria-label="Illustrative event journey">
      {stages.map(({ id, label, icon: Icon }, index) => <button key={id} id={`journey-tab-${id}`} type="button" role="tab" aria-selected={selected === id} aria-controls="journey-stage-panel" onClick={() => setSelected(id)}><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" />{label}</button>)}
    </div>
    <div id="journey-stage-panel" role="tabpanel" aria-labelledby={`journey-tab-${selected}`} className="journey-stage-panel">
      <div data-journey-copy><p className="kicker">Illustrative event · {stage.label}</p><h3>{stage.title}</h3><p>{stage.copy}</p></div>
      <figure className="journey-blueprint" aria-label={`${activeIndex + 1} of ${stages.length} illustrative journey stages shown`}>
        <div className="journey-blueprint-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(activeIndex + 1) / stages.length})` }} /></div>
        {stage.facts.map((fact, index) => <div key={fact} data-journey-fact className={index <= activeIndex % 3 ? "is-assembled" : ""}><span>{String(index + 1).padStart(2, "0")}</span><strong>{fact}</strong></div>)}
      </figure>
    </div>
    <p className="illustrative-note">Illustration only · no live booking, readiness, wallet, or payment state.</p>
  </div>;
}
