"use client";
import { useEffect, useRef } from "react";
export function DismissibleDetails({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current; if (!details) return;
    const outside = (event: PointerEvent) => { if (details.open && !details.contains(event.target as Node)) details.open = false; };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape" && details.open) { details.open = false; details.querySelector<HTMLElement>("summary")?.focus(); } };
    const navigate = (event: MouseEvent) => { if ((event.target as Element).closest("a")) details.open = false; };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard); details.addEventListener("click", navigate);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); details.removeEventListener("click", navigate); };
  }, []);
  return <details ref={ref} className={className}>{children}</details>;
}
