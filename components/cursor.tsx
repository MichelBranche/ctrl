"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce || !dot.current || !ring.current) return;

    document.documentElement.classList.add("has-cursor");
    const xDot = gsap.quickTo(dot.current, "x", {
      duration: 0.2,
      ease: "power3.out",
    });
    const yDot = gsap.quickTo(dot.current, "y", {
      duration: 0.2,
      ease: "power3.out",
    });
    const xRing = gsap.quickTo(ring.current, "x", {
      duration: 0.6,
      ease: "power3.out",
    });
    const yRing = gsap.quickTo(ring.current, "y", {
      duration: 0.6,
      ease: "power3.out",
    });
    const scaleRing = gsap.quickTo(ring.current, "scale", {
      duration: 0.4,
      ease: "power3.out",
    });
    const scaleDot = gsap.quickTo(dot.current, "scale", {
      duration: 0.35,
      ease: "power3.out",
    });
    const label = ring.current.querySelector<HTMLElement>(".cursor-label");

    const onMove = (event: MouseEvent) => {
      document.documentElement.classList.add("cursor-on");
      xDot(event.clientX);
      yDot(event.clientY);
      xRing(event.clientX);
      yRing(event.clientY);
    };

    const onOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const zone = target?.closest<HTMLElement>("[data-cursor], a, button");
      const text = zone?.getAttribute("data-cursor");
      if (label) label.textContent = text ?? "";
      ring.current?.classList.toggle("has-label", Boolean(text));
      scaleDot(text ? 0 : 1);
      scaleRing(text ? 2.15 : zone ? 1.7 : 1);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);

    return () => {
      document.documentElement.classList.remove("has-cursor", "cursor-on");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  });

  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true">
        <span className="cursor-label" />
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
