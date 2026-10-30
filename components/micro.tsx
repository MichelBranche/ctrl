"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

type Move = { x: (value: number) => void; y: (value: number) => void };

export function Micro() {
  useGSAP((_, contextSafe) => {
    if (!contextSafe) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce) return;

    const magnets = new WeakMap<HTMLElement, Move>();

    const magnetFor = contextSafe((el: HTMLElement) => {
      let move = magnets.get(el);
      if (!move) {
        move = {
          x: gsap.quickTo(el, "x", { duration: 0.55, ease: "power3.out" }),
          y: gsap.quickTo(el, "y", { duration: 0.55, ease: "power3.out" }),
        };
        magnets.set(el, move);
      }
      return move;
    });

    const onMove = contextSafe((event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const magnet = target?.closest<HTMLElement>("[data-magnetic]");
      if (magnet) {
        const bounds = magnet.getBoundingClientRect();
        const move = magnetFor(magnet);
        move.x(
          gsap.utils.clamp(
            -14,
            14,
            (event.clientX - bounds.left - bounds.width / 2) * 0.22,
          ),
        );
        move.y(
          gsap.utils.clamp(
            -10,
            10,
            (event.clientY - bounds.top - bounds.height / 2) * 0.22,
          ),
        );
      }
    });

    const onLeave = contextSafe((event: PointerEvent) => {
      const magnet = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-magnetic]",
      );
      if (!magnet) return;
      const next = event.relatedTarget;
      if (next instanceof Node && magnet.contains(next)) return;
      const move = magnets.get(magnet);
      move?.x(0);
      move?.y(0);
    });

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerout", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
    };
  });

  return null;
}
