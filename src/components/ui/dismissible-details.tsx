"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
export function DismissibleDetails({ className, children, mobileModal = false }: { className?: string; children: React.ReactNode; mobileModal?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const wasOpen = useRef(false);
  useEffect(() => {
    const details = ref.current; if (!details) return;
    const isMobileModal = () => mobileModal && window.matchMedia("(max-width: 620px)").matches;
    const unlock = () => {
      if (document.documentElement.dataset.detailsModal === "open") delete document.documentElement.dataset.detailsModal;
      document.body.style.removeProperty("overflow");
    };
    const outside = (event: PointerEvent) => {
      if (!details.open || details.contains(event.target as Node)) return;
      if (isMobileModal()) { event.preventDefault(); event.stopPropagation(); }
      details.open = false;
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!details.open) return;
      if (event.key === "Escape") { details.open = false; details.querySelector<HTMLElement>("summary")?.focus(); return; }
      if (event.key !== "Tab" || !isMobileModal()) return;
      const items = [...details.querySelectorAll<HTMLElement>("a,button,[tabindex]:not([tabindex='-1'])")].filter((item) => !item.hasAttribute("disabled") && item.getBoundingClientRect().width > 0);
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const navigate = (event: MouseEvent) => { if ((event.target as Element).closest("a,[data-close-details]")) details.open = false; };
    const closePeer = (event: Event) => { if ((event as CustomEvent).detail !== details && details.open) details.open = false; };
    const toggle = () => {
      if (details.open) {
        wasOpen.current = true;
        window.dispatchEvent(new CustomEvent("pactset-menu-open", { detail: details }));
        if (isMobileModal()) {
          document.documentElement.dataset.detailsModal = "open";
          document.body.style.overflow = "hidden";
          requestAnimationFrame(() => details.querySelector<HTMLElement>("[data-sheet-panel] [data-close-details], [data-sheet-panel] a, [data-sheet-panel] button")?.focus());
        }
      } else if (wasOpen.current && details.contains(document.activeElement)) {
        unlock();
        details.querySelector<HTMLElement>("summary")?.focus();
      } else unlock();
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", keyboard); details.addEventListener("click", navigate); details.addEventListener("toggle", toggle); window.addEventListener("pactset-menu-open", closePeer);
    return () => { unlock(); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", keyboard); details.removeEventListener("click", navigate); details.removeEventListener("toggle", toggle); window.removeEventListener("pactset-menu-open", closePeer); };
  }, [mobileModal]);
  useEffect(() => { void pathname; if (ref.current) ref.current.open = false; }, [pathname]);
  return <details ref={ref} className={`${className ?? ""}${mobileModal ? " mobile-sheet" : ""}`.trim()}>{children}</details>;
}
