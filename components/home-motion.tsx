"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const all = <T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string) =>
  Array.from(root.querySelectorAll<T>(sel));

export function HomeMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      if (!contextSafe) return;
      const scope = root.current;
      if (!scope) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const play = contextSafe(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: reduce)", () => {
          gsap.set("[data-load]", { opacity: 1, y: 0 });
          gsap.set("[data-mask]", { y: "0%" });
        });

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const splits: SplitText[] = [];

          /* ---------- HERO ---------- */
          const heroChars = all(scope, "[data-mask='hero']").map((line) => {
            const split = SplitText.create(line, { type: "words,chars", charsClass: "h-char" });
            splits.push(split);
            return split.chars;
          });

          const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
          intro
            .fromTo(".h-hero-media", { scale: 1.15, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 1.8, ease: "power3.out" }, 0)
            .fromTo("[data-load='kicker']", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 0.05)
            .fromTo(".h-hero .h-bar", { scaleX: 0 }, { scaleX: 1, transformOrigin: "0 50%", duration: 0.9, ease: "power3.inOut" }, 0.25);
          heroChars.forEach((chars, i) => {
            intro.fromTo(
              chars,
              { yPercent: 115, rotate: 6, opacity: 0 },
              { yPercent: 0, rotate: 0, opacity: 1, duration: 1.05, stagger: 0.028, ease: "back.out(1.4)" },
              0.15 + i * 0.12,
            );
          });
          intro
            .fromTo("[data-load='lead']", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.6)
            .fromTo("[data-load='cta']", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.75)
            .fromTo(".h-hero .h-tag span", { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.05 }, 0.8);

          // Hero photo: parallax + slow push-in, copy drifts up slightly.
          gsap.to(".h-hero-media", {
            yPercent: 10,
            scale: 1.08,
            ease: "none",
            scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
          });
          gsap.to(".h-hero-copy", {
            yPercent: -12,
            opacity: 0.35,
            ease: "none",
            scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
          });

          /* ---------- HEADINGS: masked lines + word stagger ---------- */
          all(scope, "[data-mask='scroll']").forEach((el) => {
            const split = SplitText.create(el, { type: "words", wordsClass: "h-word" });
            splits.push(split);
            gsap.set(el, { y: "0%" });
            gsap.fromTo(
              split.words,
              { yPercent: 115, rotate: 3 },
              {
                yPercent: 0,
                rotate: 0,
                duration: 1.1,
                stagger: 0.06,
                ease: "power4.out",
                scrollTrigger: { trigger: el, start: "top 90%" },
              },
            );
          });

          all(scope, "[data-reveal]").forEach((el) => {
            gsap.fromTo(el, { y: 32, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 0.95,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          });

          all(scope, "[data-pillars]").forEach((group) => {
            gsap.fromTo(group.querySelectorAll("[data-pillar]"), { y: 36, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.1,
              ease: "power3.out",
              scrollTrigger: { trigger: group, start: "top 85%" },
            });
          });

          /* ---------- Orange accent lines draw in ---------- */
          all(scope, ".h-root > section:not(.h-hero) .h-bar").forEach((bar) => {
            gsap.fromTo(bar, { scaleX: 0 }, {
              scaleX: 1,
              transformOrigin: "0 50%",
              duration: 1,
              ease: "power3.inOut",
              scrollTrigger: { trigger: bar, start: "top 92%" },
            });
          });
          all(scope, ".h-vline").forEach((line) => {
            gsap.fromTo(line, { scaleY: 0 }, {
              scaleY: 1,
              transformOrigin: "50% 0",
              ease: "none",
              scrollTrigger: { trigger: line, start: "top 85%", end: "bottom 60%", scrub: true },
            });
          });

          /* ---------- Image reveals: clip wipe + scale-down from 1.15 ---------- */
          all(scope, ".h-portrait-img, .h-feature-media, .h-card-media, .h-why-bg").forEach((media) => {
            const img = media.querySelector<HTMLElement>("img, .h-placeholder");
            const tl = gsap.timeline({ scrollTrigger: { trigger: media, start: "top 88%" } });
            tl.fromTo(
              media,
              { clipPath: "inset(100% 0% 0% 0%)" },
              { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power4.inOut", clearProps: "clipPath" },
            );
            if (img) tl.fromTo(img, { scale: 1.15 }, { scale: 1, duration: 1.6, ease: "power3.out" }, 0);
          });

          // "Cosa facciamo" portrait parallax (inner image drifts against scroll).
          all(scope, ".h-portrait-img img").forEach((img) => {
            gsap.fromTo(img, { yPercent: -6 }, {
              yPercent: 6,
              ease: "none",
              scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
            });
          });

          /* ---------- Project cards stagger ---------- */
          const cards = all(scope, ".h-cards .work-tilt");
          if (cards.length) {
            gsap.fromTo(cards, { y: 60, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 1,
              stagger: 0.12,
              ease: "power3.out",
              scrollTrigger: { trigger: ".h-cards", start: "top 85%" },
            });
          }

          /* ---------- Perché: light sweep across the photo ---------- */
          const why = scope.querySelector<HTMLElement>(".h-why-bg");
          let sweep: HTMLElement | null = null;
          if (why) {
            sweep = document.createElement("i");
            sweep.className = "h-sweep";
            sweep.setAttribute("aria-hidden", "true");
            why.appendChild(sweep);
            gsap.fromTo(sweep, { xPercent: -120 }, {
              xPercent: 260,
              ease: "none",
              scrollTrigger: { trigger: why, start: "top 80%", end: "bottom 20%", scrub: 0.6 },
            });
          }

          /* ---------- Stats count up (truthful values) ---------- */
          all(scope, ".h-stat dt").forEach((dt) => {
            // keep the real value even if this effect re-runs mid-count
            if (!dt.dataset.value) dt.dataset.value = dt.textContent ?? "";
            const raw = dt.dataset.value;
            dt.textContent = raw;
            const n = parseInt(raw, 10);
            const suffix = raw.replace(/^\d+/, "");
            if (Number.isNaN(n)) {
              gsap.fromTo(dt, { rotate: -180, scale: 0.4, opacity: 0 }, {
                rotate: 0, scale: 1, opacity: 1, duration: 1.4, ease: "elastic.out(1, 0.6)",
                scrollTrigger: { trigger: dt, start: "top 90%" },
              });
              return;
            }
            const o = { v: 0 };
            ScrollTrigger.create({
              trigger: dt,
              start: "top 92%",
              once: true,
              onEnter: () => {
                gsap.to(o, {
                  v: n,
                  duration: n > 10 ? 1.6 : 1,
                  ease: "power2.out",
                  onUpdate: () => { dt.textContent = `${Math.round(o.v)}${suffix}`; },
                  onComplete: () => { dt.textContent = raw; },
                  onInterrupt: () => { dt.textContent = raw; },
                });
              },
            });
          });

          return () => {
            sweep?.remove();
            all(scope, ".h-stat dt").forEach((dt) => { if (dt.dataset.value) dt.textContent = dt.dataset.value; });
            splits.forEach((s) => s.revert());
          };
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
