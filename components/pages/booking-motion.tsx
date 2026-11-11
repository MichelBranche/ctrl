"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Soft rise for the booking band. Same reveal as the contact page. Content stays visible without JS. */
export function BookingMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(".bk-root");
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      root.querySelectorAll<HTMLElement>("[data-bk-rise]").forEach((el) => {
        gsap.from(el, {
          y: 22,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });
    });
    return () => mm.revert();
  });
  return null;
}
