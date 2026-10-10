"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

export function ExperienceMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({
      anchors: { offset: -76 },
      autoRaf: false,
      duration: 0.9,
      easing: (value) => 1 - (1 - value) ** 4,
      prevent: (node) => Boolean(node.closest("[data-lenis-prevent]")),
      respectReducedMotion: true,
      stopInertiaOnNavigate: true,
      syncTouch: false,
    });
    document.documentElement.dataset.smoothScroll = "lenis";

    const update = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    let context: gsap.Context | undefined;
    let cancelled = false;
    let animationFrame = 0;
    const initialize = () => {
      if (cancelled) return;
      context = gsap.context(() => {
        const revealTargets = gsap.utils.toArray<HTMLElement>("[data-motion-reveal]");
        const splitTargets = gsap.utils.toArray<HTMLElement>("[data-split-reveal]");
        const copyTargets = gsap.utils.toArray<HTMLElement>("[data-copy-reveal]");
        if (reduceMotion) return;

        revealTargets.forEach((element) => {
          ScrollTrigger.create({
            trigger: element,
            start: "top 88%",
            once: true,
            onEnter: () => gsap.fromTo(element, { opacity: .32, y: 28 }, { opacity: 1, y: 0, duration: .72, ease: "power3.out", clearProps: "transform,opacity" }),
          });
        });

        splitTargets.forEach((heading) => {
          if (heading.closest(".pactset-hero")) return;
          const words = gsap.utils.toArray<HTMLElement>("[data-reveal-word]", heading);
          if (!words.length) return;
          ScrollTrigger.create({
            trigger: heading,
            start: "top 88%",
            once: true,
            onEnter: () => gsap.fromTo(words, { opacity: .2, y: 18 }, { opacity: 1, y: 0, duration: .52, stagger: .035, ease: "power3.out", clearProps: "transform,opacity" }),
          });
        });

        copyTargets.forEach((copy) => {
          if (copy.closest(".pactset-hero")) return;
          ScrollTrigger.create({
            trigger: copy,
            start: "top 91%",
            once: true,
            onEnter: () => gsap.fromTo(copy, { opacity: .35, y: 12 }, { opacity: 1, y: 0, duration: .45, delay: .08, ease: "power2.out", clearProps: "transform,opacity" }),
          });
        });

        const evidence = document.querySelector<HTMLElement>(".evidence-story-visual");
        if (evidence) {
          const submission = evidence.querySelector<HTMLElement>("[data-evidence-step='submission']");
          const connection = evidence.querySelector<HTMLElement>("[data-evidence-connection]");
          const decision = evidence.querySelector<HTMLElement>("[data-evidence-step='decision']");
          ScrollTrigger.create({
            trigger: evidence,
            start: "top 82%",
            once: true,
            onEnter: () => {
              const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
              if (submission) timeline.fromTo(submission, { opacity: .35, y: 16 }, { opacity: 1, y: 0, duration: .48, clearProps: "transform,opacity" });
              if (connection) timeline.fromTo(connection, { scaleY: 0, opacity: .2 }, { scaleY: 1, opacity: 1, duration: .36, transformOrigin: "top center", clearProps: "transform,opacity" }, "-=.08");
              if (decision) timeline.fromTo(decision, { opacity: .35, y: 16 }, { opacity: 1, y: 0, duration: .48, clearProps: "transform,opacity" }, "-=.1");
            },
          });
        }
      });
      ScrollTrigger.refresh();
    };

    void document.fonts.ready.then(() => {
      animationFrame = window.requestAnimationFrame(() => { animationFrame = window.requestAnimationFrame(initialize); });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      context?.revert();
      gsap.ticker.remove(update);
      lenis.destroy();
      delete document.documentElement.dataset.smoothScroll;
    };
  }, [pathname]);

  return null;
}
