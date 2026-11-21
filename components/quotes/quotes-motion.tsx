"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { scheduleRefresh } from "@/lib/refresh";
import { TEXT_SPRING, UI_SPRING, springEase } from "@/components/home/springs";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Sheet heights (z, px at 1x) for the closed stack and the open state the CSS ships with. */
const STEP = { closed: 6, open: 46, far: 62 };

/**
 * Motion for the CTRL® Quotes page, same language as the home (HomeMotionV2):
 * blurred word reveal on the text spring, template stack that opens like the home plates,
 * scroll reveals. Initial states are set here only, so everything is visible without JS
 * and with reduced motion. Step micro-animations start when their card enters (.is-in).
 */
export function QuotesMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      if (!contextSafe) return;
      const scope = root.current;
      if (!scope) return;

      const play = contextSafe(() => {
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const q = gsap.utils.selector(scope);
          const splits: SplitText[] = [];
          const sheets = q("[data-qx-sheet]");
          const unit = () => (scope.querySelector<HTMLElement>("[data-qx-tilt]")?.offsetWidth ?? 240) / 240;

          const words = q("[data-qx-words]").flatMap((el) => {
            const split = SplitText.create(el, { type: "words", wordsClass: "qx-word" });
            splits.push(split);
            return split.words;
          });

          const u = unit();
          sheets.forEach((s, i) => gsap.set(s, { z: i * STEP.closed * u }));
          const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
          intro
            .fromTo(words, { opacity: 0.001, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: TEXT_SPRING.duration, stagger: 0.05, ease: springEase(TEXT_SPRING), clearProps: "filter" }, 0.25)
            .fromTo(q("[data-qx-fade]"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.55)
            .fromTo(q("[data-qx-stack]"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6 }, 0.2);
          sheets.forEach((s, i) => {
            intro.to(s, { z: i * STEP.open * u, duration: 1.9, ease: "elastic.out(1, 0.75)", clearProps: "transform" }, 0.85 + i * 0.07);
          });

          // Scrolling out of the hero opens the stack a little further and turns it.
          const out = gsap.timeline({
            scrollTrigger: { trigger: q("[data-qx-hero]")[0], start: "top top", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true },
          });
          sheets.forEach((s, i) => out.to(s, { z: () => i * STEP.far * unit(), ease: "none" }, 0));
          out.to(q("[data-qx-spin]"), { rotationZ: "+=8", ease: "none" }, 0).to(q("[data-qx-stack]"), { yPercent: -8, ease: "none" }, 0);

          q("[data-qx-title]").forEach((el) => {
            const split = SplitText.create(el, { type: "words", wordsClass: "qx-word" });
            splits.push(split);
            gsap.fromTo(split.words, { opacity: 0, y: 40, filter: "blur(10px)" }, {
              opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.05, ease: "expo.out", clearProps: "filter",
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          });
          q("[data-qx-rise]").forEach((el) => {
            gsap.fromTo(el, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } });
          });
          q("[data-qx-stagger]").forEach((group) => {
            gsap.fromTo(group.children, { opacity: 0, y: 36, scale: 0.98 }, {
              opacity: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.08, ease: springEase(UI_SPRING), clearProps: "transform",
              scrollTrigger: { trigger: group, start: "top 88%" },
            });
          });
          q("[data-qx-loop]").forEach((el) => {
            ScrollTrigger.create({ trigger: el, start: "top 85%", end: "bottom 10%", toggleClass: "is-in" });
          });

          return () => splits.forEach((s) => s.revert());
        });
        scheduleRefresh();
      });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("is-ready")) {
        play();
        return;
      }
      window.addEventListener("ctrl:ready", play, { once: true });
      return () => window.removeEventListener("ctrl:ready", play);
    },
    { scope: root },
  );

  return (
    <div ref={root} data-motion-root className="qx-motion">
      {children}
    </div>
  );
}
