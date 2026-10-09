"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

type SpotlightStyle = CSSProperties & {
  "--spotlight-x"?: string;
  "--spotlight-y"?: string;
  "--spotlight-color"?: string;
};

/** Project-adapted from React Bits' Spotlight Card interaction pattern. */
export function SpotlightSurface({ children, className = "", color = "rgba(223, 161, 45, .16)" }: { children: ReactNode; className?: string; color?: string }) {
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const trackPointer = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
      element.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
    };
    element.addEventListener("pointermove", trackPointer);
    return () => element.removeEventListener("pointermove", trackPointer);
  }, []);

  const style: SpotlightStyle = { "--spotlight-color": color };
  return <div ref={surface} className={`spotlight-surface ${className}`} style={style}>{children}</div>;
}
