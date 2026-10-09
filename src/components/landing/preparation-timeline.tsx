"use client";

import { useGSAP } from "@gsap/react";
import { ArrowsClockwise, Buildings, ForkKnife, HardHat, SpeakerHigh } from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const categories = [
  { id: "venue", label: "Venue", icon: Buildings, explanation: "Venue access unlocks every setup task. Confirm rooms, loading access, and the accountable contact first.", active: [0] },
  { id: "equipment", label: "Equipment", icon: SpeakerHigh, explanation: "Equipment setup starts after venue access is confirmed.", active: [0, 1] },
  { id: "food", label: "Food", icon: ForkKnife, explanation: "Food preparation is scheduled for event morning as an explicit exception to the 17 OCT preparation deadline.", active: [2, 3] },
  { id: "crew", label: "Crew", icon: HardHat, explanation: "Crew checks follow equipment setup and confirm the hand-off before guests arrive.", active: [1, 2, 3] },
] as const;

const milestones = [
  { date: "16 OCT", title: "Venue access", detail: "Rooms and loading route confirmed" },
  { date: "17 OCT", title: "Equipment setup", detail: "Sound, staging, and power checked" },
  { date: "17 OCT", title: "Crew checks", detail: "Roles, timing, and evidence agreed" },
  { date: "18 OCT", title: "Ready for guests", detail: "Food completes on event morning" },
];

export function PreparationTimeline() {
  const [selected, setSelected] = useState<(typeof categories)[number]["id"]>("equipment");
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<gsap.core.Timeline | null>(null);
  const active = categories.find((category) => category.id === selected) ?? categories[0];

  const { contextSafe } = useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { gsap.set("[data-timeline-progress]", { scaleX: 1, scaleY: 1 }); gsap.set("[data-checkpoint]", { opacity: 1 }); return; }
    const vertical = window.matchMedia("(max-width: 620px)").matches;
    const timeline = gsap.timeline({ paused: true });
    timeline.set("[data-timeline-progress]", { scaleX: vertical ? 1 : 0, scaleY: vertical ? 0 : 1, transformOrigin: vertical ? "top center" : "left center" })
      .set("[data-checkpoint]", { opacity: .48 })
      .to("[data-timeline-progress]", { scaleX: 1, scaleY: 1, duration: 1.8, ease: "none" });
    root.current?.querySelectorAll("[data-checkpoint]").forEach((item, index) => { timeline.to(item, { opacity: 1, duration: .18, className: "+=is-complete", ease: "power2.out" }, .12 + index * .48); });
    progress.current = timeline;
    ScrollTrigger.create({ trigger: root.current, start: "top 78%", once: true, onEnter: () => timeline.play() });
    return () => { progress.current = null; };
  }, { scope: root });

  const replay = contextSafe(() => progress.current?.restart());

  return <div ref={root} className="preparation-experience">
    <div className="preparation-selector" role="tablist" aria-label="Illustrative event preparation categories">
      {categories.map(({ id, label, icon: Icon }) => <button key={id} id={`prep-tab-${id}`} type="button" role="tab" aria-selected={selected === id} aria-controls="preparation-panel" onClick={() => setSelected(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    <div id="preparation-panel" role="tabpanel" aria-labelledby={`prep-tab-${selected}`} className="preparation-panel">
      <div className="illustrative-label"><span>Illustrative event</span><strong>18 OCT</strong><small>Preparation deadline · 17 OCT<br />Food preparation · event morning</small></div>
      <ol className="milestone-track" aria-label="Venue access, equipment setup, crew checks, ready for guests">
        <span className="milestone-line" aria-hidden="true"><i data-timeline-progress /></span>
        {milestones.map((milestone, index) => <li key={milestone.title} className={(active.active as readonly number[]).includes(index) ? "is-active" : ""} data-checkpoint><span className="milestone-dot" aria-hidden="true" /><time>{milestone.date}</time><h3>{milestone.title}</h3><p>{milestone.detail}</p></li>)}
      </ol>
      <p className="preparation-explanation" aria-live="polite"><strong>{active.label}</strong><span>{active.explanation}</span></p>
      <div className="illustrative-note"><span>Illustration only · not live booking or payment status.</span><button type="button" className="text-button timeline-replay" onClick={replay}><ArrowsClockwise aria-hidden="true" /> Replay</button></div>
    </div>
  </div>;
}
