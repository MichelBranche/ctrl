"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Small fixed back-to-top with a progress ring that draws as you scroll. */
export function BackToTop() {
  const btn = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    const el = btn.current;
    if (!el) return;
    const ring = el.querySelector<SVGCircleElement>("circle.btt-ring");
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        el.classList.toggle("is-visible", self.scroll() > window.innerHeight * 1.2);
        if (ring) ring.style.strokeDashoffset = String(100 - self.progress * 100);
      },
    });
  });

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.__lenis && !reduce) window.__lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button ref={btn} type="button" className="back-to-top" aria-label="Back to top" onClick={toTop}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" pathLength={100} className="btt-track" />
        <circle cx="20" cy="20" r="18" pathLength={100} className="btt-ring" />
        <path d="M20 27V13M14 19l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}
