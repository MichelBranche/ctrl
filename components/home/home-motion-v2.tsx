"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { scheduleRefresh } from "@/lib/refresh";
import { TEXT_SPRING, springEase } from "./springs";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Plate heights (z, in plate units) for the closed stack and the open state the CSS ships with. */
const Z = {
  closed: { brand: 26, glass: 42 },
  open: { brand: 120, glass: 272 },
  far: { brand: 150, glass: 330 },
};

/**
 * Motion for the home page. Initial states are set here only, so every word
 * and plate is visible without JS and with reduced motion (open stack, no blur).
 */
export function HomeMotionV2({ children }: { children: React.ReactNode }) {
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
          // --u is a clamp() expression, so measure it: the tilted plane is 380 units wide.
          const unit = () => (scope.querySelector<HTMLElement>(".hp-tilt")?.offsetWidth ?? 380) / 380;
          const brand = q("[data-plate='brand']");
          const glass = q("[data-plate='glass']");
          const spin = q("[data-plates-spin]");
          const shadow = q("[data-plates-shadow]");
          const splits: SplitText[] = [];

          /* ---------- HERO: words, plates, pill ---------- */
          const words = q("[data-hv-words]").flatMap((el) => {
            const split = SplitText.create(el, { type: "words", wordsClass: "hv-word" });
            splits.push(split);
            return split.words;
          });

          const u = unit();
          // Closed stack first: set before the timeline so clearProps on the opening tweens cannot skip it.
          gsap.set(brand, { z: Z.closed.brand * u });
          gsap.set(glass, { z: Z.closed.glass * u });
          const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
          intro
            // Reference title reveal: per word, opacity and blur(10px) on a 2s critically damped spring, 50ms apart.
            .fromTo(words, { opacity: 0.001, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: TEXT_SPRING.duration, stagger: 0.05, ease: springEase(TEXT_SPRING), clearProps: "filter" }, 0.3)
            .fromTo(q("[data-hv-fade]"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.6)
            .fromTo(q("[data-plates]"), { y: 80 * u, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6 }, 0.25)
            .to(brand, { z: Z.open.brand * u, duration: 1.9, ease: "elastic.out(1, 0.75)", clearProps: "transform" }, 0.95)
            .to(glass, { z: Z.open.glass * u, duration: 2.1, ease: "elastic.out(1, 0.7)", clearProps: "transform" }, 1.05)
            .fromTo(shadow, { opacity: 0.95, scale: 0.94 }, { opacity: 0.7, scale: 1.04, duration: 1.8, ease: "power3.out" }, 0.95)
            .fromTo(q("[data-hv-pill]"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1 }, 1.1);

          // Scrolling out of the hero opens the stack a little further and turns it.
          const out = gsap.timeline({
            scrollTrigger: { trigger: q("[data-hv-hero]")[0], start: "top top", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true },
          });
          out
            .to(brand, { z: () => Z.far.brand * unit(), ease: "none" }, 0)
            .to(glass, { z: () => Z.far.glass * unit(), ease: "none" }, 0)
            .to(spin, { rotationZ: "+=8", ease: "none" }, 0)
            .to(q("[data-plates]"), { yPercent: -10, ease: "none" }, 0);

          /* ---------- Blocks: titles and cards ---------- */
          q("[data-hv-title]").forEach((el) => {
            const split = SplitText.create(el, { type: "words", wordsClass: "hv-word" });
            splits.push(split);
            gsap.fromTo(split.words, { opacity: 0, y: 40, filter: "blur(10px)" }, {
              opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.05, ease: "expo.out", clearProps: "filter",
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          });
          q("[data-hv-rise]").forEach((el) => {
            gsap.fromTo(el, { opacity: 0, y: 48 }, {
              opacity: 1, y: 0, duration: 1.1, ease: "expo.out",
              scrollTrigger: { trigger: el, start: "top 92%" },
            });
          });
          q("[data-hv-stagger]").forEach((group) => {
            gsap.fromTo(group.children, { opacity: 0, y: 36 }, {
              opacity: 1, y: 0, duration: 1, stagger: 0.07, ease: "expo.out",
              scrollTrigger: { trigger: group, start: "top 90%" },
            });
          });
          q("[data-hv-parallax]").forEach((el) => {
            gsap.fromTo(el, { yPercent: -6, scale: 1.12 }, {
              yPercent: 6, scale: 1.12, ease: "none",
              scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
            });
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
    <div ref={root} data-motion-root className="hv-motion">
      {children}
    </div>
  );
}
