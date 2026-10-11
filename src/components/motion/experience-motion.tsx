"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motionSystem } from "@/lib/motion-system";

gsap.registerPlugin(ScrollTrigger);

const visualSelectors = [
  ".connected-journey",
  ".roles-spotlight",
  ".preparation-experience",
  ".evidence-story-visual",
  ".payment-story ol",
  ".support-sequence",
  ".faq-list",
  ".final-cta > div",
].join(",");

function revealLanding() {
  const sections = gsap.utils.toArray<HTMLElement>("[data-motion-reveal], .final-cta");

  sections.forEach((section, sectionIndex) => {
    const words = gsap.utils.toArray<HTMLElement>("[data-reveal-word]", section);
    const copy = gsap.utils.toArray<HTMLElement>("[data-copy-reveal]", section);
    const visuals = gsap.utils.toArray<HTMLElement>(visualSelectors, section);
    const direction = sectionIndex % 3 === 1 ? -1 : sectionIndex % 3 === 2 ? 1 : 0;
    if (!words.length && !copy.length && !visuals.length) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 84%",
      once: true,
      onEnter: () => {
        const timeline = gsap.timeline();
        if (words.length) timeline.fromTo(words, { opacity: 0.28, y: motionSystem.distance.content }, { opacity: 1, y: 0, duration: motionSystem.duration.content, stagger: motionSystem.stagger.word, ease: motionSystem.ease.enter, clearProps: "transform,opacity" });
        if (copy.length) timeline.fromTo(copy, { opacity: 0.42, y: motionSystem.distance.compact }, { opacity: 1, y: 0, duration: motionSystem.duration.content, stagger: motionSystem.stagger.item, ease: motionSystem.ease.settle, clearProps: "transform,opacity" }, words.length ? "-=0.34" : 0);
        if (visuals.length) timeline.fromTo(visuals, { opacity: 0.46, x: direction * motionSystem.distance.section, y: direction ? motionSystem.distance.compact : motionSystem.distance.content }, { opacity: 1, x: 0, y: 0, duration: motionSystem.duration.section, stagger: motionSystem.stagger.item, ease: motionSystem.ease.enter, clearProps: "transform,opacity" }, words.length || copy.length ? "-=0.32" : 0);
      },
    });
  });

  const evidence = document.querySelector<HTMLElement>(".evidence-story-visual");
  if (evidence) {
    const submission = evidence.querySelector<HTMLElement>("[data-evidence-step='submission']");
    const connection = evidence.querySelector<HTMLElement>("[data-evidence-connection]");
    const decision = evidence.querySelector<HTMLElement>("[data-evidence-step='decision']");
    ScrollTrigger.create({ trigger: evidence, start: "top 78%", once: true, onEnter: () => {
      const timeline = gsap.timeline({ defaults: { ease: motionSystem.ease.enter } });
      if (submission) timeline.fromTo(submission, { opacity: 0.4, x: -18 }, { opacity: 1, x: 0, duration: 0.5, clearProps: "transform,opacity" });
      if (connection) timeline.fromTo(connection, { scaleY: 0, opacity: 0.25 }, { scaleY: 1, opacity: 1, duration: 0.38, transformOrigin: "top center", clearProps: "transform,opacity" }, "-=0.08");
      if (decision) timeline.fromTo(decision, { opacity: 0.4, x: 18 }, { opacity: 1, x: 0, duration: 0.5, clearProps: "transform,opacity" }, "-=0.08");
    } });
  }
}

function revealApplication() {
  // Application entrances are CSS-driven so streamed forms hydrate without
  // an animation library mutating their root nodes first.
}

export function ExperienceMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const landing = pathname === "/";
    const root = document.querySelector<HTMLElement>(landing ? ".pactset-landing" : "body");
    if (!root) return;

    const media = gsap.matchMedia();
    let lenis: Lenis | undefined;
    let ticker: ((time: number) => void) | undefined;
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    let secondFrame = 0;
    let delay = 0;
    let observerDelay = 0;
    let cancelled = false;

    media.add({ reduceMotion: "(prefers-reduced-motion: reduce)", finePointer: "(hover: hover) and (pointer: fine)" }, (context) => {
      const reduceMotion = Boolean(context.conditions?.reduceMotion);
      const finePointer = Boolean(context.conditions?.finePointer);

      if (reduceMotion) {
        gsap.set("[data-reveal-word], [data-copy-reveal], [data-motion-reveal], .workspace-main > :not(.workspace-topbar), .settings-page > *, .auth-grid > *", { clearProps: "all" });
        return;
      }

      if (landing && finePointer) {
        lenis = new Lenis({
          anchors: { offset: -88 },
          autoRaf: false,
          duration: 0.9,
          easing: (value) => 1 - (1 - value) ** 4,
          prevent: (node) => Boolean(node.closest("[data-lenis-prevent]")),
          stopInertiaOnNavigate: true,
          syncTouch: false,
        });
        document.documentElement.dataset.smoothScroll = "lenis";
        ticker = (time: number) => lenis?.raf(time * 1000);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(ticker);
        gsap.ticker.lagSmoothing(0);
      }

      let motionContext: gsap.Context | undefined;
      void document.fonts.ready.then(() => {
        if (cancelled) return;
        delay = window.setTimeout(() => {
          frame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
              if (cancelled) return;
              motionContext = gsap.context(() => {
                if (landing) revealLanding();
                else revealApplication();
              }, root);
              ScrollTrigger.refresh();
            });
          });
        }, 120);
      });
      return () => {
        window.clearTimeout(delay);
        window.cancelAnimationFrame(frame);
        window.cancelAnimationFrame(secondFrame);
        observer?.disconnect();
        motionContext?.revert();
      };
    }, root);

    if (landing) {
      observerDelay = window.setTimeout(() => {
        if (cancelled) return;
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) entry.target.classList.toggle("is-motion-visible", entry.isIntersecting);
        }, { rootMargin: "120px 0px" });
        for (const artwork of root.querySelectorAll(".architectural-lines")) observer.observe(artwork);
      }, 1500);
    }

    const refresh = () => ScrollTrigger.refresh();
    void document.fonts.ready.then(() => { if (!cancelled) refresh(); });
    window.addEventListener("pageshow", refresh);

    return () => {
      cancelled = true;
      window.clearTimeout(delay);
      window.clearTimeout(observerDelay);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("pageshow", refresh);
      observer?.disconnect();
      media.revert();
      if (ticker) gsap.ticker.remove(ticker);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
      delete document.documentElement.dataset.smoothScroll;
    };
  }, [pathname]);

  return null;
}
