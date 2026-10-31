"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Motion for /projects and category pages. Start states are set here only, so content stays visible without JS or with reduced motion. */
export function ProjectsMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(".p-root");
    if (!root) return;
    const q = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = gsap.timeline({ delay: 0.15 });
      const title = root.querySelector<HTMLElement>("[data-p-split]");
      if (title) {
        const split = SplitText.create(title, { type: "words,chars", mask: "words" });
        intro.from(split.chars, { yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.04 }, 0.1);
      }
      intro.from(q("[data-p-fade]"), { y: 22, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0);
      const img = root.querySelector("[data-p-hero-img]");
      if (img) {
        intro.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 2.2, ease: "power2.out" }, 0);
        gsap.to(img, { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".p-hero", start: "top top", end: "bottom top", scrub: true } });
      }

      q("[data-p-fade-scroll]").forEach((el) =>
        gsap.from(el, { y: 28, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }),
      );

      // Cards rise in batches; the inner tag bar draws in after.
      const cards = q("[data-p-card]");
      if (cards.length) {
        gsap.set(cards, { y: 44, autoAlpha: 0 });
        ScrollTrigger.batch(cards, {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.05, ease: "power3.out", stagger: 0.1, overwrite: true }),
        });
      }

      // Images drift inside their frame while scrolling.
      q("[data-p-parallax]").forEach((el) =>
        gsap.fromTo(
          el,
          { yPercent: -5 },
          { yPercent: 5, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } },
        ),
      );
    });

    return () => mm.revert();
  });

  return null;
}
