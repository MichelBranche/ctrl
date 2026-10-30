"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

const MAGNET =
  "[data-magnetic], .h-circle, .h-round-link, .cmd-trigger, .menu-toggle, .back-to-top, .lang-switch";
const VIEW_TARGET = ".h-card, .h-feature-media, .work-card-link";

type Move = { x: (value: number) => void; y: (value: number) => void };

export function Micro() {
  useGSAP((_, contextSafe) => {
    if (!contextSafe) return;

    // Ctrl/Cmd + K: physically press the header keycaps (works on touch keyboards too).
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      document.querySelectorAll(".cmd-trigger").forEach((el) => {
        el.classList.remove("is-pressed");
        void (el as HTMLElement).offsetWidth;
        el.classList.add("is-pressed");
        window.setTimeout(() => el.classList.remove("is-pressed"), 320);
      });
    };
    window.addEventListener("keydown", onKey);
    const removeKey = () => window.removeEventListener("keydown", onKey);

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce) return removeKey;

    // Cursor-follow "Vedi"/"View" label on project cards (pure garnish; links stay labelled).
    const label = document.createElement("div");
    label.className = "cursor-label";
    label.setAttribute("aria-hidden", "true");
    document.body.appendChild(label);
    gsap.set(label, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });
    const lx = gsap.quickTo(label, "x", { duration: 0.45, ease: "power3.out" });
    const ly = gsap.quickTo(label, "y", { duration: 0.45, ease: "power3.out" });
    let labelOn = false;

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
      lx(event.clientX);
      ly(event.clientY);
      const view = !!target?.closest(VIEW_TARGET);
      if (view !== labelOn) {
        labelOn = view;
        if (view) label.textContent = document.documentElement.lang === "en" ? "View" : "Vedi";
        gsap.to(label, { scale: view ? 1 : 0, autoAlpha: view ? 1 : 0, duration: 0.35, ease: view ? "back.out(2)" : "power2.in", overwrite: "auto" });
      }
      const magnet = target?.closest<HTMLElement>(MAGNET);
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
        MAGNET,
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
      removeKey();
      label.remove();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
    };
  });

  return null;
}
