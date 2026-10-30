"use client";

import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Elements owned by another motion system (home, footer) are skipped.
const OWNED = "[data-motion-root], [data-no-reveal]";

function free<T extends HTMLElement>(selector: string): T[] {
  return gsap.utils
    .toArray<T>(selector)
    .filter((el) => !el.closest(OWNED) && !el.querySelector("[data-mask], .line-mask"));
}

/**
 * Global scroll reveals for inner pages. Initial states are set by GSAP only,
 * so content stays visible if JS fails or motion is reduced.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useGSAP(
    (_, contextSafe) => {
      if (!contextSafe) return;

      const play = contextSafe(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          // Headings: line by line, masked slide up.
          free<HTMLElement>("main h1, main h2").forEach((heading) => {
            SplitText.create(heading, {
              type: "lines",
              mask: "lines",
              linesClass: "reveal-line",
              autoSplit: true,
              onSplit: (self) =>
                gsap.from(self.lines, {
                  yPercent: 110,
                  duration: 1.1,
                  ease: "power4.out",
                  stagger: 0.09,
                  scrollTrigger: { trigger: heading, start: "top 88%", once: true },
                }),
            });
          });

          // Media and project cards: clip-path wipe from the bottom, inner ease-out zoom.
          free<HTMLElement>("main .work-media, main .case-media").forEach((media) => {
            const inner = media.querySelector<HTMLElement>("img, .type-tile");
            const tl = gsap.timeline({
              scrollTrigger: { trigger: media, start: "top 90%", once: true },
            });
            tl.fromTo(
              media,
              { clipPath: "inset(100% 0% 0% 0%)" },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.3,
                ease: "power4.inOut",
                clearProps: "clipPath",
              },
            );
            if (inner) {
              tl.fromTo(
                inner,
                { scale: 1.12 },
                { scale: 1, duration: 1.6, ease: "power3.out", clearProps: "scale" },
                0,
              );
            }
          });

          // Lists: subtle stagger per list.
          free<HTMLElement>("main ul, main ol").forEach((list) => {
            const items = Array.from(list.children) as HTMLElement[];
            if (!items.length) return;
            gsap.from(items, {
              y: 18,
              opacity: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.06,
              clearProps: "transform,opacity",
              scrollTrigger: { trigger: list, start: "top 88%", once: true },
            });
          });
        });

        requestAnimationFrame(() => ScrollTrigger.refresh());
      });

      if (document.documentElement.classList.contains("is-ready")) {
        play();
        return;
      }
      window.addEventListener("ctrl:ready", play, { once: true });
      return () => window.removeEventListener("ctrl:ready", play);
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}
