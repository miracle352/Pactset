"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

gsap.registerPlugin(ScrollTrigger);
gsap.registerPlugin(useGSAP);

export function ExperienceMotion() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useGSAP(() => {
    if (!mounted) return;
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
    const animationTimer = window.setTimeout(() => {
      context = gsap.context(() => {
        const heroTargets = gsap.utils.toArray<HTMLElement>("[data-motion-hero]");
        const revealTargets = gsap.utils.toArray<HTMLElement>("[data-motion-reveal]");
        if (reduceMotion) {
          if (heroTargets.length || revealTargets.length) gsap.set([...heroTargets, ...revealTargets], { clearProps: "all" });
          return;
        }

        if (heroTargets.length) {
          gsap.fromTo(
            heroTargets,
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.82, stagger: 0.08, ease: "power3.out", clearProps: "transform" },
          );
        }

        revealTargets.forEach((element) => {
          gsap.fromTo(
            element,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.72,
              ease: "power3.out",
              clearProps: "transform",
              scrollTrigger: { trigger: element, start: "top 88%", once: true },
            },
          );
        });

        const heroImage = document.querySelector<HTMLElement>(".hero-image");
        if (heroImage) {
          gsap.to(heroImage, {
            yPercent: 7,
            scale: 1.035,
            ease: "none",
            scrollTrigger: { trigger: ".pactset-hero", start: "top top", end: "bottom top", scrub: 0.5 },
          });
        }
      });
      ScrollTrigger.refresh();
    }, 350);

    return () => {
      window.clearTimeout(animationTimer);
      context?.revert();
      gsap.ticker.remove(update);
      lenis.destroy();
      delete document.documentElement.dataset.smoothScroll;
    };
  }, { dependencies: [mounted, pathname], revertOnUpdate: true });

  return null;
}
