"use client";

import { useRef, type RefObject } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

const ACCENT = "#ff4a1c";

/**
 * Per-letter orange hover on a big wordmark: each `[data-letter]` turns
 * orange (with a tiny lift) while the pointer is over it, then eases back.
 * Entering the whole mark plays a subtle wave; a tap plays a one-shot
 * left-to-right wave. Reduced motion: colour only, no movement.
 */
export function useLetterHover(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const letters = gsap.utils.toArray<HTMLElement>("[data-letter]", root);
      if (!letters.length) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const base = getComputedStyle(letters[0]).color;
      const lift = reduce ? {} : { yPercent: -4 };
      const rest = reduce ? {} : { yPercent: 0 };

      const on = (el: HTMLElement, delay = 0) =>
        gsap.to(el, { color: ACCENT, ...lift, duration: 0.25, delay, ease: "power2.out", overwrite: "auto" });
      const off = (el: HTMLElement, delay = 0) =>
        gsap.to(el, { color: base, ...rest, duration: 0.6, delay, ease: "power2.out", overwrite: "auto" });

      const wave = (amount: number) => {
        letters.forEach((el, i) => {
          const d = (i * amount) / letters.length;
          gsap.timeline({ delay: d })
            .to(el, { color: ACCENT, ...lift, duration: 0.22, ease: "power2.out" })
            .to(el, { color: base, ...rest, duration: 0.5, ease: "power2.out" }, "+=0.12");
        });
      };

      let touch = false;
      const cleanups: (() => void)[] = [];
      const listen = (el: EventTarget, type: string, fn: (e: Event) => void) => {
        el.addEventListener(type, fn);
        cleanups.push(() => el.removeEventListener(type, fn));
      };

      letters.forEach((el) => {
        listen(el, "pointerenter", (e) => {
          if ((e as PointerEvent).pointerType === "mouse") on(el);
        });
        listen(el, "pointerleave", (e) => {
          if ((e as PointerEvent).pointerType === "mouse") off(el, 0.15);
        });
      });
      listen(root, "pointerdown", (e) => {
        touch = (e as PointerEvent).pointerType !== "mouse";
        if (touch) wave(0.4);
      });
      listen(root, "pointerenter", (e) => {
        if ((e as PointerEvent).pointerType !== "mouse") return;
        // subtle colour-only shimmer on entry; the hovered letter takes over.
        letters.forEach((el, i) => {
          gsap.fromTo(el, { opacity: 1 }, { opacity: 0.7, duration: 0.12, delay: i * 0.04, yoyo: true, repeat: 1 });
        });
      });

      return () => cleanups.forEach((c) => c());
    },
    { scope },
  );
}

export function CtrlMark({ className }: { className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLetterHover(ref);
  return (
    <p className={className} aria-label="CTRL®" ref={ref}>
      {"CTRL".split("").map((l) => (
        <span data-letter aria-hidden="true" key={l} style={{ display: "inline-block" }}>
          {l}
        </span>
      ))}
      <sup data-letter aria-hidden="true" style={{ display: "inline-block" }}>
        ®
      </sup>
    </p>
  );
}
