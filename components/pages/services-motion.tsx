"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { playWhenReady } from "@/lib/ready";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Motion for /services. Initial states are set here only, so content stays
 * visible without JS and under prefers-reduced-motion.
 */
export function ServicesMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(".s-root");
    if (!root) return;
    const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T & Element>(sel)) as T[];
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Hero: chars rise through a mask, then tag, lead and CTA fade up.
      const title = root.querySelector<HTMLElement>("[data-s-split]");
      const intro = gsap.timeline({ delay: 0.15, paused: true });
      playWhenReady(intro);
      if (title) {
        const split = SplitText.create(title, { type: "words,chars", mask: "words" });
        intro.from(split.chars, { yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.035 }, 0.1);
      }
      intro.from(q("[data-s-fade]"), { y: 22, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0);
      const img = root.querySelector("[data-s-hero-img]");
      if (img) {
        intro.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 2.2, ease: "power2.out" }, 0);
        gsap.to(img, {
          yPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: ".s-hero", start: "top top", end: "bottom top", scrub: true },
        });
      }

      // Grid: dividers draw in, then cells stagger up.
      const grid = root.querySelector(".s-grid-wrap");
      const tl = gsap.timeline({ scrollTrigger: { trigger: grid, start: "top 82%", once: true } });
      tl.fromTo(q("[data-s-rule='x']"), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power3.inOut" }, 0)
        .fromTo(q("[data-s-rule='y']"), { scaleY: 0 }, { scaleY: 1, duration: 1.4, ease: "power3.inOut", stagger: 0.12 }, 0.1)
        .from(q("[data-s-cell]"), { y: 40, autoAlpha: 0, duration: 1, ease: "power3.out", stagger: 0.09 }, 0.25)
        .from(q(".s-points li"), { x: -10, autoAlpha: 0, duration: 0.6, ease: "power2.out", stagger: 0.025 }, 0.6);

      // Line-art mark draws itself, sparkle pops in.
      const paths = q<SVGPathElement>(".s-mark [data-draw]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.timeline({ scrollTrigger: { trigger: ".s-cell-mark", start: "top 85%", once: true } })
        .to(paths, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", stagger: 0.35 })
        .from(".s-spark", { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.8, ease: "back.out(2)" }, "-=0.8");

      // Modes: intro, cards lift in, checks stagger.
      gsap.from(q("[data-s-fade-scroll]"), {
        y: 30, autoAlpha: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: ".s-modes", start: "top 82%", once: true },
      });
      q("[data-s-card]").forEach((card, i) => {
        gsap.timeline({ scrollTrigger: { trigger: ".s-modes", start: "top 80%", once: true }, delay: 0.15 + i * 0.12 })
          .from(card, { y: 48, autoAlpha: 0, duration: 1.1, ease: "power3.out" })
          .from(card.querySelectorAll("[data-s-check]"), { x: -12, autoAlpha: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }, "-=0.5");
      });
    });

    return () => mm.revert();
  });

  return null;
}
