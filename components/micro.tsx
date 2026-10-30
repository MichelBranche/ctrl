"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

type Move = { x: (value: number) => void; y: (value: number) => void };
type Tilt = { rx: (value: number) => void; ry: (value: number) => void };

export function Micro() {
  useGSAP((_, contextSafe) => {
    if (!contextSafe) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce) return;

    const magnets = new WeakMap<HTMLElement, Move>();
    const tilts = new WeakMap<HTMLElement, Tilt>();
    let tilted: HTMLElement | null = null;

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

    const tiltFor = contextSafe((el: HTMLElement) => {
      let tilt = tilts.get(el);
      if (!tilt) {
        gsap.set(el, { transformPerspective: 800 });
        tilt = {
          rx: gsap.quickTo(el, "rotationX", {
            duration: 0.55,
            ease: "power3.out",
          }),
          ry: gsap.quickTo(el, "rotationY", {
            duration: 0.55,
            ease: "power3.out",
          }),
        };
        tilts.set(el, tilt);
      }
      return tilt;
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

      const card = target?.closest<HTMLElement>("[data-tilt]");
      const media = card?.querySelector<HTMLElement>(".tilt-target");
      if (tilted && tilted !== media) {
        const previous = tilts.get(tilted);
        previous?.rx(0);
        previous?.ry(0);
      }
      tilted = media ?? null;
      if (!card || !media) return;

      const bounds = card.getBoundingClientRect();
      const tilt = tiltFor(media);
      const px = (event.clientX - bounds.left) / bounds.width - 0.5;
      const py = (event.clientY - bounds.top) / bounds.height - 0.5;
      tilt.ry(px * 7);
      tilt.rx(py * -5);
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
