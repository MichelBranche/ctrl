"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ENTER_SPRING, TEXT_SPRING, springEase } from "@/components/home/springs";
import { playWhenReady } from "@/lib/ready";
import { scheduleRefresh } from "@/lib/refresh";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Motion for /services, on the home springs. Initial states are set here only, so content stays
 * visible without JS and under prefers-reduced-motion.
 */
export function ServicesMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(".sv");
    if (!root) return;
    const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T & Element>(sel)) as T[];
    const enter = springEase(ENTER_SPRING);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const splits: SplitText[] = [];

      // Hero: title words clear their blur on the text spring, then tag, lead and CTA rise.
      const intro = gsap.timeline({ paused: true });
      playWhenReady(intro);
      q("[data-sv-words]").forEach((el) => {
        const split = SplitText.create(el, { type: "words", wordsClass: "sv-word" });
        splits.push(split);
        intro.fromTo(split.words, { opacity: 0.001, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: TEXT_SPRING.duration, stagger: 0.05, ease: springEase(TEXT_SPRING), clearProps: "filter" }, 0.2);
      });
      intro.fromTo(q("[data-sv-fade]"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: ENTER_SPRING.duration, stagger: 0.08, ease: enter }, 0.45);
      const img = root.querySelector("[data-sv-hero-img]");
      if (img) {
        intro.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 2.2, ease: "power2.out" }, 0);
        gsap.to(img, { yPercent: 6, ease: "none", scrollTrigger: { trigger: "[data-sv-hero]", start: "top top", end: "bottom top", scrub: true } });
      }

      // Blocks: titles by word, single blocks rise, card groups stagger.
      q("[data-sv-title]").forEach((el) => {
        const split = SplitText.create(el, { type: "words", wordsClass: "sv-word" });
        splits.push(split);
        gsap.fromTo(split.words, { opacity: 0, y: 40, filter: "blur(10px)" }, {
          opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.05, ease: "expo.out", clearProps: "filter",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });
      q("[data-sv-rise]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: ENTER_SPRING.duration, ease: enter, scrollTrigger: { trigger: el, start: "top 92%" } });
      });
      q("[data-sv-stagger]").forEach((group) => {
        gsap.fromTo(group.children, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: ENTER_SPRING.duration, stagger: 0.07, ease: enter,
          scrollTrigger: { trigger: group, start: "top 90%" },
        });
      });

      // Line-art mark draws itself, sparkle pops in.
      const paths = q<SVGPathElement>(".sv-mark [data-draw]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.timeline({ scrollTrigger: { trigger: ".sv-mark-card", start: "top 85%", once: true } })
        .to(paths, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", stagger: 0.35 })
        .from(".sv-spark", { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.8, ease: "back.out(2)" }, "-=0.8");

      scheduleRefresh();
      return () => splits.forEach((s) => s.revert());
    });

    return () => mm.revert();
  });

  return null;
}
