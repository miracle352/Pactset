"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CountdownValue = { days: string; hours: string; minutes: string; status: "active" | "overdue" | "missing" | "complete" };

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
    previous.current = value; setChanging(true);
    const timer = window.setTimeout(() => setChanging(false), 520);
    return () => window.clearTimeout(timer);
  }, [value]);
  return <span className={`flap-character${changing ? " is-flipping" : ""}`} aria-hidden="true"><i>{value}</i></span>;
}

function FlapPair({ value, label }: { value: string; label: string }) {
  return <div className="flap-unit"><span className="flap-pair"><FlapCharacter value={value[0] ?? "-"} /><FlapCharacter value={value[1] ?? "-"} /></span><small>{label}</small></div>;
}

export function SplitFlapCountdown({ targetIso, timezone, illustrative = false, illustrativeRun = 0, complete = false, label = "Preparation deadline" }: { targetIso?: string | null; timezone: string; illustrative?: boolean; illustrativeRun?: number; complete?: boolean; label?: string }) {
  const initial = useMemo<CountdownValue>(() => illustrative ? { days: "07", hours: "12", minutes: "30", status: "active" } : calculate(targetIso, complete), [illustrative, targetIso, complete]);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (illustrative) {
      if (!illustrativeRun || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setValue({ days: "08", hours: "00", minutes: "00", status: "active" });
      const illustrativeTimer = window.setTimeout(() => setValue({ days: "07", hours: "12", minutes: "30", status: "active" }), 420);
      return () => window.clearTimeout(illustrativeTimer);
    }
    const update = () => setValue(calculate(targetIso, complete));
    update();
    const timer = window.setInterval(update, 30_000);
    const resume = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [illustrative, illustrativeRun, targetIso, complete]);

  const statusText = value.status === "complete" ? "Preparation marked complete" : value.status === "overdue" ? "Deadline passed; preparation still needs confirmation" : value.status === "missing" ? "Preparation deadline not set" : `${value.days} days, ${value.hours} hours, ${value.minutes} minutes remaining`;
  return <section className={`split-flap-countdown is-${value.status}`} aria-label={`${label}. ${statusText}. Timezone ${timezone}.`}>
    <div className="flap-heading"><div><p className="kicker">{illustrative ? "Illustrative countdown" : label}</p><strong>{statusText}</strong></div><span>{timezone}</span></div>
    <div className="flap-display" aria-hidden="true"><FlapPair value={value.days} label="Days" /><span className="flap-separator">:</span><FlapPair value={value.hours} label="Hours" /><span className="flap-separator">:</span><FlapPair value={value.minutes} label="Minutes" /></div>
    {value.status === "overdue" && <p className="field-note">Time reaching zero does not mark the work complete.</p>}
  </section>;
}
