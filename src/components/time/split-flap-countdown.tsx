"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CountdownValue = { days: string; hours: string; minutes: string; status: "active" | "overdue" | "missing" | "complete" | "cancelled" };

function calculate(targetIso?: string | null, complete?: boolean): CountdownValue {
  if (complete) return { days: "00", hours: "00", minutes: "00", status: "complete" };
  if (!targetIso) return { days: "--", hours: "--", minutes: "--", status: "missing" };
  const remaining = new Date(targetIso).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return { days: "00", hours: "00", minutes: "00", status: "overdue" };
  const totalMinutes = Math.floor(remaining / 60_000);
  return { days: String(Math.floor(totalMinutes / 1440)).padStart(2, "0"), hours: String(Math.floor((totalMinutes % 1440) / 60)).padStart(2, "0"), minutes: String(totalMinutes % 60).padStart(2, "0"), status: "active" };
}

function FlapCharacter({ value }: { value: string }) {
  const previous = useRef(value);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setChanging(false); return; }
    setChanging(true);
    const timer = window.setTimeout(() => setChanging(false), 520);
    return () => window.clearTimeout(timer);
  }, [value]);
  return <span className={`flap-character${changing ? " is-flipping" : ""}`} aria-hidden="true"><i>{value}</i></span>;
}

function FlapPair({ value, label }: { value: string; label: string }) {
  return <div className="flap-unit"><span className="flap-pair"><FlapCharacter value={value[0] ?? "-"} /><FlapCharacter value={value[1] ?? "-"} /></span><small>{label}</small></div>;
}

export function SplitFlapCountdown({ targetIso, timezone, illustrative = false, complete = false, cancelled = false, label = "Preparation deadline" }: { targetIso?: string | null; timezone: string; illustrative?: boolean; complete?: boolean; cancelled?: boolean; label?: string }) {
  const root = useRef<HTMLElement>(null);
  const hasIllustrated = useRef(false);
  const initial = useMemo<CountdownValue>(() => cancelled ? { days: "--", hours: "--", minutes: "--", status: "cancelled" } : illustrative ? { days: "08", hours: "00", minutes: "00", status: "active" } : calculate(targetIso, complete), [illustrative, targetIso, complete, cancelled]);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (illustrative) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setValue({ days: "07", hours: "12", minutes: "30", status: "active" });
        return;
      }
      const node = root.current;
      if (!node) return;
      let illustrativeTimer = 0;
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting || hasIllustrated.current) return;
        hasIllustrated.current = true;
        illustrativeTimer = window.setTimeout(() => setValue({ days: "07", hours: "12", minutes: "30", status: "active" }), 220);
        observer.disconnect();
      }, { threshold: .45 });
      observer.observe(node);
      return () => { observer.disconnect(); window.clearTimeout(illustrativeTimer); };
    }
    if (cancelled) {
      setValue({ days: "--", hours: "--", minutes: "--", status: "cancelled" });
      return;
    }
    const update = () => setValue(calculate(targetIso, complete));
    update();
    const timer = window.setInterval(update, 30_000);
    const resume = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [illustrative, targetIso, complete, cancelled]);

  const statusText = value.status === "cancelled" ? "Booking cancelled; the deadline is no longer active" : value.status === "complete" ? "Preparation marked complete" : value.status === "overdue" ? "Deadline passed; preparation still needs confirmation" : value.status === "missing" ? "Preparation deadline not set" : `${value.days} days, ${value.hours} hours, ${value.minutes} minutes remaining`;
  return <section ref={root} className={`split-flap-countdown is-${value.status}`} aria-label={`${label}. ${statusText}. Timezone ${timezone}.`}>
    <div className="flap-heading"><div><p className="kicker">{label}</p>{illustrative && <small>Example event</small>}<strong>{statusText}</strong></div><span>{timezone}</span></div>
    <div className="flap-display" aria-hidden="true"><FlapPair value={value.days} label="Days" /><span className="flap-separator">:</span><FlapPair value={value.hours} label="Hours" /><span className="flap-separator">:</span><FlapPair value={value.minutes} label="Minutes" /></div>
    {value.status === "overdue" && <p className="field-note">Time reaching zero does not mark the work complete.</p>}
  </section>;
}
