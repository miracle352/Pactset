"use client";

import { useGSAP } from "@gsap/react";
import { Buildings, ForkKnife, HardHat, SpeakerHigh } from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { SplitFlapCountdown } from "@/components/time/split-flap-countdown";

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
  const active = categories.find((category) => category.id === selected) ?? categories[0];

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const checkpoints = gsap.utils.toArray<HTMLElement>("[data-checkpoint]");
    const track = root.current?.querySelector<HTMLElement>("[data-timeline-track]");
    const line = root.current?.querySelector<HTMLElement>("[data-timeline-progress]");
    const signal = root.current?.querySelector<HTMLElement>("[data-timeline-signal]");
    if (!track || !line || !signal) return;
    if (reduced) {
      gsap.set(line, { scaleX: 1, scaleY: 1 });
      gsap.set(signal, { opacity: 0 });
      gsap.set(checkpoints, { opacity: 1 });
      for (const checkpoint of checkpoints) checkpoint.classList.add("is-reached");
      return;
    }

    let vertical = window.matchMedia("(max-width: 620px)").matches;
    const setProgress = (progress: number) => {
      vertical = window.matchMedia("(max-width: 620px)").matches;
      const distance = Math.max(0, (vertical ? track.clientHeight : track.clientWidth) - 8);
      gsap.set(line, vertical
        ? { scaleX: 1, scaleY: progress, transformOrigin: "top center" }
        : { scaleX: progress, scaleY: 1, transformOrigin: "left center" });
      gsap.set(signal, vertical ? { x: 0, y: progress * distance } : { x: progress * distance, y: 0 });
      checkpoints.forEach((checkpoint, index) => {
        const threshold = index / Math.max(checkpoints.length - 1, 1);
        const localProgress = Math.max(0, Math.min(1, (progress - threshold + .16) / .16));
        checkpoint.classList.toggle("is-reached", progress + .015 >= threshold);
        checkpoint.classList.toggle("is-current", Math.abs(progress - threshold) < .075);
        gsap.set(checkpoint.querySelectorAll("time,h3,p"), { y: (1 - localProgress) * 8, opacity: .45 + localProgress * .55 });
      });
    };

    setProgress(0);
    const scrollProgress = ScrollTrigger.create({
      trigger: root.current,
      start: "top 82%",
      end: "bottom 28%",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => setProgress(self.progress),
      onRefresh: (self) => setProgress(self.progress),
    });
    return () => scrollProgress.kill();
  }, { scope: root });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".preparation-explanation > *", { opacity: .35, y: 9 }, { opacity: 1, y: 0, duration: .28, stagger: .035, ease: "power2.out", clearProps: "transform,opacity" });
  }, { scope: root, dependencies: [selected], revertOnUpdate: true });

  return <div ref={root} className="preparation-experience">
    <SplitFlapCountdown illustrative timezone="Africa/Lagos" label="Preparation deadline" />
    <div className="preparation-selector" role="tablist" aria-label="Illustrative event preparation categories">
      {categories.map(({ id, label, icon: Icon }) => <button key={id} id={`prep-tab-${id}`} type="button" role="tab" aria-selected={selected === id} aria-controls="preparation-panel" onClick={() => setSelected(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    <div id="preparation-panel" role="tabpanel" aria-labelledby={`prep-tab-${selected}`} className="preparation-panel">
      <div className="illustrative-label"><span>Illustrative event</span><strong>18 OCT</strong><small>Preparation deadline · 17 OCT<br />Food preparation · event morning</small></div>
      <ol className="milestone-track" data-timeline-track aria-label="Venue access, equipment setup, crew checks, ready for guests">
        <span className="milestone-line" aria-hidden="true"><i data-timeline-progress /><b data-timeline-signal /></span>
        {milestones.map((milestone, index) => <li key={milestone.title} className={(active.active as readonly number[]).includes(index) ? "is-active" : ""} data-checkpoint><span className="milestone-dot" aria-hidden="true" /><time>{milestone.date}</time><h3>{milestone.title}</h3><p>{milestone.detail}</p></li>)}
      </ol>
      <p className="preparation-explanation" aria-live="polite"><strong>{active.label}</strong><span>{active.explanation}</span></p>
      <div className="illustrative-note"><span>Illustration only · not live booking or payment status.</span></div>
    </div>
  </div>;
}
