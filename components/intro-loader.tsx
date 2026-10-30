"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

function markSeen() {
  try {
    sessionStorage.setItem("ctrl-intro", "1");
  } catch {
    /* private mode */
  }
}

function signalReady() {
  if (document.documentElement.classList.contains("is-ready")) return;
  document.documentElement.classList.add("is-ready");
  window.dispatchEvent(new Event("ctrl:ready"));
}

/** Mascot pops in last with a squish (only after the cinematic intro). */
function popMascot() {
  const el = document.querySelector<HTMLElement>(".ca-root");
  document.documentElement.classList.remove("intro-running");
  if (!el) return;
  gsap.fromTo(
    el,
    { scale: 0, yPercent: 40, transformOrigin: "100% 100%" },
    {
      keyframes: [
        { scale: 1.12, scaleY: 0.86, yPercent: 0, duration: 0.32, ease: "power3.out" },
        { scale: 0.96, scaleY: 1.06, duration: 0.16, ease: "sine.inOut" },
        { scale: 1, scaleY: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" },
      ],
      clearProps: "transform",
    },
  );
}

/**
 * Cinematic intro: a "Ctrl + K" shortcut is physically pressed, a mono counter
 * runs 000 -> 100, the keys split and the screen cracks open like the hero's
 * concrete portal (two panels part vertically behind a light beam). The page
 * is fully SSR'd underneath; this overlay is fixed and aria-hidden, so no CLS.
 * Skippable by click / key, once per session, instant under reduced motion.
 */
export function IntroLoader() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      if (!contextSafe) return;
      const el = root.current;
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem("ctrl-intro") === "1";
      } catch {
        seen = false;
      }

      if (reduce || seen) {
        gsap.set(el, { autoAlpha: 0, display: "none" });
        markSeen();
        signalReady();
        return;
      }

      document.documentElement.classList.add("intro-running");
      const count = { v: 0 };
      const num = el.querySelector<HTMLElement>("[data-intro-count]");
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.set(el, { autoAlpha: 0, display: "none" });
        },
      });

      tl.from("[data-key]", { y: 40, opacity: 0, rotateX: -50, duration: 0.5, stagger: 0.08 }, 0)
        .from("[data-intro-plus]", { scale: 0, opacity: 0, duration: 0.3 }, 0.2)
        // Physical press: cap travels down, shadow collapses, then springs back.
        .to("[data-key='ctrl']", { y: 6, "--key-depth": "0px", duration: 0.09, ease: "power2.in" }, 0.55)
        .to("[data-key='k']", { y: 6, "--key-depth": "0px", duration: 0.09, ease: "power2.in" }, 0.72)
        .to("[data-key]", { y: 0, "--key-depth": "6px", duration: 0.35, ease: "elastic.out(1, 0.45)" }, 0.95)
        .to("[data-intro-glow]", { opacity: 1, duration: 0.2, yoyo: true, repeat: 1 }, 0.72)
        .to(count, {
          v: 100,
          duration: 1.2,
          ease: "power2.inOut",
          onUpdate: () => {
            if (num) num.textContent = String(Math.round(count.v)).padStart(3, "0");
          },
        }, 0.3)
        .to("[data-intro-bar]", { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, 0.3)
        // Split: keys fly apart, the seam lights up, panels open like a portal.
        .to("[data-key='ctrl']", { x: -60, opacity: 0, duration: 0.45, ease: "power3.in" }, 1.55)
        .to("[data-key='k']", { x: 60, opacity: 0, duration: 0.45, ease: "power3.in" }, 1.55)
        .to(["[data-intro-plus]", "[data-intro-meta]"], { opacity: 0, duration: 0.25 }, 1.55)
        .fromTo("[data-intro-beam]", { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.4, ease: "power4.inOut" }, 1.7)
        .add(() => {
          markSeen();
          signalReady();
        }, 2.0)
        .to("[data-intro-panel='top']", { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, 2.0)
        .to("[data-intro-panel='bottom']", { yPercent: 100, duration: 0.9, ease: "power4.inOut" }, 2.0)
        .to("[data-intro-beam]", { scaleY: 40, opacity: 0, duration: 0.7, ease: "power2.out" }, 2.05)
        .add(popMascot, 2.6);

      const skip = contextSafe(() => {
        if (tl.progress() >= 1) return;
        markSeen();
        signalReady();
        gsap.to(el, {
          autoAlpha: 0,
          duration: 0.3,
          onComplete: () => {
            tl.kill();
            gsap.set(el, { display: "none" });
          },
        });
        popMascot();
      });
      window.addEventListener("keydown", skip, { once: true });
      el.addEventListener("pointerdown", skip, { once: true });
      return () => {
        window.removeEventListener("keydown", skip);
        el.removeEventListener("pointerdown", skip);
      };
    },
    { scope: root },
  );

  return (
    <div className="intro" ref={root} aria-hidden="true">
      <i className="intro-panel intro-panel-top" data-intro-panel="top" />
      <i className="intro-panel intro-panel-bottom" data-intro-panel="bottom" />
      <i className="intro-beam" data-intro-beam />
      <div className="intro-center">
        <div className="intro-keys">
          <i className="intro-glow" data-intro-glow />
          <span className="intro-key intro-key-wide mono" data-key="ctrl">Ctrl</span>
          <span className="intro-plus mono" data-intro-plus>+</span>
          <span className="intro-key mono" data-key="k">K</span>
        </div>
        <div className="intro-meta mono" data-intro-meta>
          <span data-intro-count>000</span>
          <i className="intro-bar"><i data-intro-bar /></i>
          <span>CTRL®</span>
        </div>
      </div>
    </div>
  );
}
