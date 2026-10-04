"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function MobilePlanAction() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const action = document.getElementById("hero-actions");
    if (!action) return;

    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0.15 });
    observer.observe(action);

    const viewport = window.visualViewport;
    const initialHeight = viewport?.height ?? window.innerHeight;
    const syncKeyboard = () => {
      const currentHeight = viewport?.height ?? window.innerHeight;
      document.documentElement.dataset.keyboardOpen = String(initialHeight - currentHeight > 140);
    };
    viewport?.addEventListener("resize", syncKeyboard);

    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", syncKeyboard);
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);

  return (
    <div className="mobile-plan-bar glass-panel" data-visible={visible}>
      <Link href="/onboarding">Plan an event <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  );
}
