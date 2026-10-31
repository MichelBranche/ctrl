"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Motion for /journal and articles. States are set here only, so content stays visible without JS or with reduced motion. */
export function JournalMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(".j-root");
    if (!root) return;
    const q = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = gsap.timeline({ delay: 0.15 });
      const title = root.querySelector<HTMLElement>("[data-j-split]");
      if (title) {
        const split = SplitText.create(title, { type: "words,chars", mask: "words" });
        intro.from(split.chars, { yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.04 }, 0.1);
      }
      intro.from(q("[data-j-fade]"), { y: 22, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0);
      const img = root.querySelector("[data-j-hero-img]");
      if (img) {
        intro.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 2.2, ease: "power2.out" }, 0);
        gsap.to(img, { yPercent: 8, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top top", end: "bottom top", scrub: true } });
      }
      q("[data-j-fade-scroll]").forEach((el) =>
        gsap.from(el, { y: 28, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
      );
      const cards = q("[data-j-card]");
      if (cards.length) {
        gsap.set(cards, { y: 40, autoAlpha: 0 });
        ScrollTrigger.batch(cards, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", stagger: 0.1, overwrite: true }),
        });
      }
    });

    return () => mm.revert();
  });

  return null;
}
