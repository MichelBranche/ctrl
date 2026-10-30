"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function HomeMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      if (!contextSafe) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const play = contextSafe(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: reduce)", () => {
          gsap.set("[data-load]", { opacity: 1, y: 0 });
          gsap.set("[data-mask]", { y: "0%" });
        });

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
          intro
            .fromTo(".h-hero-media", { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6, ease: "power3.out" }, 0)
            .fromTo("[data-load='kicker']", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 0.05)
            .fromTo("[data-mask='hero']", { y: "115%" }, { y: "0%", duration: 1.15, stagger: 0.09 }, 0.12)
            .fromTo("[data-load='lead']", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.55)
            .fromTo("[data-load='cta']", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.7);

          gsap.to(".h-hero-media", {
            yPercent: 8,
            ease: "none",
            scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
          });

          gsap.utils.toArray<HTMLElement>("[data-mask='scroll']").forEach((el) => {
            gsap.fromTo(el, { y: "115%" }, {
              y: "0%",
              duration: 1.1,
              ease: "power4.out",
              scrollTrigger: { trigger: el, start: "top 90%" },
            });
          });

          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
            gsap.fromTo(el, { y: 32, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 0.95,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          });

          gsap.utils.toArray<HTMLElement>("[data-pillars]").forEach((group) => {
            gsap.fromTo(group.querySelectorAll("[data-pillar]"), { y: 36, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.1,
              ease: "power3.out",
              scrollTrigger: { trigger: group, start: "top 85%" },
            });
          });
        });

        requestAnimationFrame(() => ScrollTrigger.refresh());
      });

      if (reduce || document.documentElement.classList.contains("is-ready")) {
        play();
        return;
      }
      window.addEventListener("ctrl:ready", play, { once: true });
      return () => window.removeEventListener("ctrl:ready", play);
    },
    { scope: root },
  );

  return (
    <div ref={root} data-motion-root>
      {children}
    </div>
  );
}
