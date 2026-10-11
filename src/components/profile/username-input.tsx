"use client";

import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid" | "unavailable";

export function UsernameInput({ defaultValue = "", id = "username", label = "Username" }: { defaultValue?: string; id?: string; label?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [message, setMessage] = useState("Use 3–30 lowercase letters, numbers, or underscores.");
  const requestNumber = useRef(0);

  useEffect(() => {
    const normalized = normalizeUsername(value);
    const validation = usernameValidationMessage(normalized);
    if (!normalized) {
      setAvailability("idle");
      setMessage("Use 3–30 lowercase letters, numbers, or underscores.");
      return;
    }
    if (validation) {
      setAvailability("invalid");
      setMessage(validation);
      return;
    }
    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    setAvailability("checking");
    setMessage("Checking availability…");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/username/availability?username=${encodeURIComponent(normalized)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { status?: Availability; message?: string };
        if (currentRequest !== requestNumber.current) return;
        setAvailability(result.status ?? "unavailable");
        setMessage(result.message ?? "Availability could not be checked. You can still try saving.");
      } catch {
        if (controller.signal.aborted || currentRequest !== requestNumber.current) return;
        setAvailability("unavailable");
        setMessage("Availability could not be checked. You can still try saving.");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  return <div className="username-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} name="username" value={value} onChange={(event) => setValue(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9_]{2,29}" autoComplete="username" aria-describedby={`${id}-status`} aria-invalid={availability === "invalid" || availability === "taken"} required />
    <p id={`${id}-status`} className={`username-availability ${availability}`} aria-live="polite">
      {availability === "checking" ? <SpinnerGap className="spin" aria-hidden="true" /> : availability === "available" ? <CheckCircle aria-hidden="true" /> : availability === "invalid" || availability === "taken" ? <WarningCircle aria-hidden="true" /> : null}
      {message}
    </p>
  </div>;
}
