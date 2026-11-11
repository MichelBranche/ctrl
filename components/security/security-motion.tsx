"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Extra motion for the security section, on top of ProjectsMotion (which fades the heads and lifts the cards).
 * Start states live here only, so the content stays visible without JS and with reduced motion.
 */
export function SecurityMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>("[data-sec]");
    if (!root) return;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const visual = root.querySelector<HTMLElement>("[data-sec-visual]");
      if (visual) {
        gsap.fromTo(
          visual,
          { clipPath: "inset(12% 8% 12% 8% round 0.6rem)", autoAlpha: 0.2 },
          {
            clipPath: "inset(0% 0% 0% 0% round 0.6rem)",
            autoAlpha: 1,
            duration: 1.4,
            ease: "power3.inOut",
            scrollTrigger: { trigger: visual, start: "top 85%", once: true },
          },
        );
        gsap.from(visual.querySelector(".sec-chip"), {
          y: 16,
          autoAlpha: 0,
          duration: 0.8,
          delay: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: visual, start: "top 85%", once: true },
        });
      }

      root.querySelectorAll<HTMLElement>("[data-sec-plan]").forEach((plan, index) => {
        gsap.from(plan.querySelectorAll("[data-sec-check]"), {
          x: -12,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.out",
          stagger: 0.07,
          delay: 0.35 + index * 0.12,
          scrollTrigger: { trigger: plan, start: "top 88%", once: true },
        });
      });

      // CTA: the shield outline draws itself, then the tick.
      const marks = Array.from(root.querySelectorAll<SVGPathElement>("[data-sec-draw]"));
      if (marks.length) {
        marks.forEach((path) => {
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.to(marks, {
          strokeDashoffset: 0,
          duration: 1.8,
          ease: "power2.inOut",
          stagger: 0.3,
          scrollTrigger: { trigger: root.querySelector(".sec-cta"), start: "top 85%", once: true },
        });
      }

      const table = root.querySelector<HTMLElement>("[data-sec-compare]");
      if (table) {
        gsap.from(table.querySelectorAll("[data-sec-row]"), {
          y: 24,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: table, start: "top 88%", once: true },
        });
      }
    });

    return () => mm.revert();
  });

  return null;
}
