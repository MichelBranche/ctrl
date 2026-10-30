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

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const play = contextSafe(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: reduce)", () => {
          gsap.set("[data-load]", { opacity: 1, y: 0, scale: 1 });
          gsap.set("[data-mask]", { y: "0%", yPercent: 0 });
          gsap.set(".hero-visual", { clipPath: "inset(0% 0% 0% 0%)" });
        });

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const intro = gsap.timeline({ defaults: { ease: "power4.out" } });

          intro
            .fromTo(
              ".hero-visual",
              { clipPath: "inset(0% 0% 100% 0%)" },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.35,
                ease: "power4.inOut",
              },
              0,
            )
            .fromTo(
              "[data-mask='hero']",
              { y: "120%" },
              { y: "0%", duration: 1.15, stagger: 0.08, overwrite: "auto" },
              0.12,
            )
            .fromTo(
              "[data-load='kicker']",
              { y: 16, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
              0.05,
            )
            .fromTo(
              "[data-load='lead']",
              { y: 24, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" },
              0.48,
            )
            .fromTo(
              "[data-load='cta']",
              { y: 16, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
              0.62,
            )
            .fromTo(
              "[data-load='poster']",
              { opacity: 0, scale: 1.08 },
              {
                opacity: 1,
                scale: 1,
                duration: 1.3,
                ease: "power3.out",
              },
              0.35,
            )
            .fromTo(
              "[data-load='scroll']",
              { opacity: 0 },
              { opacity: 1, duration: 0.6 },
              0.9,
            );

          gsap.fromTo(
            ".hero-media",
            { yPercent: -6 },
            {
              yPercent: 8,
              ease: "none",
              scrollTrigger: {
                trigger: "[data-hero]",
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            },
          );

          gsap.fromTo(
            ".hero-media img",
            { scale: 1.16 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: "[data-hero]",
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            },
          );

          gsap.utils.toArray<HTMLElement>("[data-mask='scroll']").forEach((el) => {
            gsap.fromTo(
              el,
              { y: "120%" },
              {
                y: "0%",
                duration: 1.15,
                ease: "power4.out",
                overwrite: "auto",
                scrollTrigger: { trigger: el, start: "top 90%" },
              },
            );
          });

          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
            gsap.fromTo(
              el,
              { y: 32, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.95,
                ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 88%" },
                onComplete: () => gsap.set(el, { clearProps: "opacity" }),
              },
            );
          });

          gsap.utils.toArray<HTMLElement>("[data-draw]").forEach((el) => {
            gsap.fromTo(
              el,
              { scaleX: 0 },
              {
                scaleX: 1,
                duration: 1.2,
                ease: "power3.inOut",
                scrollTrigger: { trigger: el, start: "top 88%" },
              },
            );
          });

          gsap.utils.toArray<HTMLElement>(".service-cell").forEach((cell, index) => {
            gsap.fromTo(
              cell,
              { y: 36, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.9,
                delay: index * 0.05,
                ease: "power3.out",
                scrollTrigger: { trigger: ".service-grid", start: "top 82%" },
                onComplete: () => gsap.set(cell, { clearProps: "opacity" }),
              },
            );
          });
        });

        mm.add(
          "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
          () => {
            const track = root.current?.querySelector<HTMLElement>(
              "[data-work-track]",
            );
            const section = root.current?.querySelector<HTMLElement>(
              "[data-work]",
            );
            const float = root.current?.querySelector<HTMLElement>(
              "[data-float]",
            );
            const hero = root.current?.querySelector<HTMLElement>("[data-hero]");
            if (!track || !section) return;

            const distance = () =>
              Math.max(0, track.scrollWidth - window.innerWidth);

            const tween = gsap.to(track, {
              x: () => -distance(),
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: () => `+=${distance()}`,
                pin: true,
                scrub: 0.85,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            gsap.utils.toArray<HTMLElement>(".work-pan", track).forEach((pan, index) => {
              gsap.fromTo(
                pan,
                { xPercent: index % 2 === 0 ? -4 : 4 },
                {
                  xPercent: index % 2 === 0 ? 4 : -4,
                  ease: "none",
                  scrollTrigger: {
                    trigger: pan,
                    containerAnimation: tween,
                    start: "left right",
                    end: "right left",
                    scrub: true,
                  },
                },
              );
            });

            if (!float) return;

            const xTo = gsap.quickTo(float, "x", {
              duration: 0.8,
              ease: "power3.out",
            });
            const yTo = gsap.quickTo(float, "y", {
              duration: 0.8,
              ease: "power3.out",
            });
            const rTo = gsap.quickTo(float, "rotation", {
              duration: 0.9,
              ease: "power3.out",
            });

            const onMove = (event: MouseEvent) => {
              if (!hero) return;
              const bounds = hero.getBoundingClientRect();
              if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
              const nx = event.clientX / window.innerWidth - 0.5;
              const ny = event.clientY / window.innerHeight - 0.5;
              xTo(nx * 28);
              yTo(ny * 18);
              rTo(nx * 3.5);
            };

            window.addEventListener("mousemove", onMove);
            return () => window.removeEventListener("mousemove", onMove);
          },
        );

        mm.add(
          "(max-width: 899px) and (prefers-reduced-motion: no-preference)",
          () => {
            gsap.utils.toArray<HTMLElement>(".work-card").forEach((card) => {
              gsap.fromTo(
                card,
                { y: 40, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.9,
                  ease: "power3.out",
                  scrollTrigger: { trigger: card, start: "top 90%" },
                },
              );
            });
          },
        );

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
