"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

// Adapted from Hover.dev's Tilt Card: spring-like rotateX/rotateY on an inner
// wrapper (so the scroll-reveal clip-path on .work-media stays untouched),
// with a little translateZ depth on the image and title layers.
const MAX_ROTATE = 7; // total range in degrees (+/- 3.5)
const HALF = MAX_ROTATE / 2;
const DEPTH = { media: 24, caption: 28 };

export function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const el = ref.current;
      if (!el || !contextSafe) return;

      const mm = gsap.matchMedia();
      mm.add("(pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
        const media = el.querySelector<HTMLElement>(".work-media");
        const caption = el.querySelector<HTMLElement>(".work-caption");
        gsap.set(el, { transformPerspective: 900, transformStyle: "preserve-3d" });
        if (media) gsap.set(media, { z: DEPTH.media });
        if (caption) gsap.set(caption, { z: DEPTH.caption });

        // Soft spring feel (stiffness ~150, damping ~20) via eased quickTo.
        const opts = { duration: 0.6, ease: "power3.out" };
        const rx = gsap.quickTo(el, "rotationX", opts);
        const ry = gsap.quickTo(el, "rotationY", opts);

        const onMove = contextSafe!((event: PointerEvent) => {
          const b = el.getBoundingClientRect();
          const px = (event.clientX - b.left) / b.width - 0.5;
          const py = (event.clientY - b.top) / b.height - 0.5;
          ry(gsap.utils.clamp(-HALF, HALF, px * MAX_ROTATE));
          rx(gsap.utils.clamp(-HALF, HALF, py * -MAX_ROTATE));
        });
        const onLeave = contextSafe!(() => {
          rx(0);
          ry(0);
        });

        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
          gsap.set([el, media, caption].filter(Boolean), { clearProps: "transform,transformStyle" });
        };
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="work-tilt">
      {children}
    </div>
  );
}
