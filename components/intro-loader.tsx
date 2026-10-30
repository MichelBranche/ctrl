"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Wordmark } from "@/components/wordmark";

gsap.registerPlugin(useGSAP);

function signalReady() {
  document.documentElement.classList.add("is-ready");
  window.dispatchEvent(new Event("ctrl:ready"));
  try {
    sessionStorage.setItem("ctrl-intro", "1");
  } catch {
    /* private mode */
  }
}

export function IntroLoader() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem("ctrl-intro") === "1";
      } catch {
        seen = false;
      }

      if (reduce || seen) {
        gsap.set(root.current, { autoAlpha: 0 });
        if (!document.documentElement.classList.contains("is-ready")) {
          signalReady();
        }
        return;
      }

      const tl = gsap.timeline();
      tl.fromTo(
        "[data-loader-mark]",
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      )
        .fromTo(
          "[data-loader-line]",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: "power2.inOut" },
          0.12,
        )
        .to(
          root.current,
          {
            yPercent: -100,
            duration: 1.1,
            ease: "power4.inOut",
            onStart: signalReady,
            onComplete: () => {
              gsap.set(root.current, { autoAlpha: 0 });
            },
          },
          0.95,
        );
    },
    { scope: root },
  );

  return (
    <div className="intro" ref={root} aria-hidden="true">
      <div className="intro-center">
        <p data-loader-mark>
          <Wordmark />
        </p>
        <i data-loader-line />
      </div>
    </div>
  );
}
