"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
export function DismissibleDetails({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const wasOpen = useRef(false);
  useEffect(() => {
    const details = ref.current; if (!details) return;
    const outside = (event: PointerEvent) => { if (details.open && !details.contains(event.target as Node)) details.open = false; };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape" && details.open) { details.open = false; details.querySelector<HTMLElement>("summary")?.focus(); } };
    const navigate = (event: MouseEvent) => { if ((event.target as Element).closest("a")) details.open = false; };
    const closePeer = (event: Event) => { if ((event as CustomEvent).detail !== details && details.open) details.open = false; };
    const toggle = () => {
      if (details.open) {
        wasOpen.current = true;
        window.dispatchEvent(new CustomEvent("pactset-menu-open", { detail: details }));
      } else if (wasOpen.current && details.contains(document.activeElement)) {
        details.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard); details.addEventListener("click", navigate); details.addEventListener("toggle", toggle); window.addEventListener("pactset-menu-open", closePeer);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); details.removeEventListener("click", navigate); details.removeEventListener("toggle", toggle); window.removeEventListener("pactset-menu-open", closePeer); };
  }, []);
  useEffect(() => { void pathname; if (ref.current) ref.current.open = false; }, [pathname]);
  return <details ref={ref} className={className}>{children}</details>;
}
