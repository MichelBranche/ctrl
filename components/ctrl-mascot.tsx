"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/* Cloud silhouette built from overlapping lobes (viewBox 0 0 240 200). */
function Lobes() {
  return (
    <>
      <circle cx="78" cy="104" r="46" />
      <circle cx="126" cy="80" r="56" />
      <circle cx="174" cy="108" r="40" />
      <rect x="40" y="96" width="166" height="62" rx="31" />
    </>
  );
}

export function CtrlMascot() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const body = q(".cm-body")[0];
      const face = q(".cm-face")[0];
      const eyes = q(".cm-eye");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const touch = window.matchMedia("(hover: none)").matches;

      gsap.set([body, face], { transformOrigin: "50% 85%" });
      gsap.set(eyes, { transformOrigin: "50% 50%" });

      let blinkCall: gsap.core.Tween | null = null;
      const blink = () => {
        const tl = gsap.timeline();
        tl.to(eyes, { scaleY: 0.1, duration: 0.07, ease: "power2.in" }).to(eyes, { scaleY: 1, duration: 0.12, ease: "power2.out" });
        if (Math.random() < 0.22) tl.to(eyes, { scaleY: 0.1, duration: 0.07, delay: 0.08 }).to(eyes, { scaleY: 1, duration: 0.12 });
        blinkCall = gsap.delayedCall(gsap.utils.random(2, 6), blink);
      };
      blinkCall = gsap.delayedCall(1.5, blink);
      if (reduce) return () => blinkCall?.kill();

      // idle float + breath
      gsap.to(el.querySelector(".cm-float"), { y: -8, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(body, { scaleX: 1.015, scaleY: 0.985, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(q(".cm-shadow"), { scaleX: 0.9, opacity: 0.55, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 50%" });

      const faceX = gsap.quickTo(face, "x", { duration: 0.6, ease: "power3.out" });
      const faceY = gsap.quickTo(face, "y", { duration: 0.6, ease: "power3.out" });
      const tilt = gsap.quickTo(q(".cm-tilt")[0], "rotation", { duration: 0.9, ease: "power3.out" });
      const skew = gsap.quickTo(q(".cm-tilt")[0], "skewX", { duration: 0.9, ease: "power3.out" });
      gsap.set(q(".cm-tilt"), { transformOrigin: "50% 90%" });

      const lookAt = (px: number, py: number) => {
        const r = el.getBoundingClientRect();
        const dx = gsap.utils.clamp(-1, 1, (px - (r.left + r.width / 2)) / (window.innerWidth * 0.45));
        const dy = gsap.utils.clamp(-1, 1, (py - (r.top + r.height * 0.45)) / (window.innerHeight * 0.45));
        faceX(dx * 16);
        faceY(dy * 10);
        tilt(dx * 5);
        skew(-dx * 2.5);
      };

      // occasional curious head tilt
      const curious = () => {
        gsap.to(q(".cm-head"), { rotation: gsap.utils.random([-7, 6]), duration: 0.7, ease: "power2.inOut", yoyo: true, repeat: 1, repeatDelay: 1.1, transformOrigin: "50% 80%" });
        curiousCall = gsap.delayedCall(gsap.utils.random(6, 11), curious);
      };
      let curiousCall = gsap.delayedCall(5, curious);

      const cleanups: Array<() => void> = [];
      if (touch) {
        const wander = () => {
          lookAt(gsap.utils.random(0, window.innerWidth), gsap.utils.random(0, window.innerHeight));
          wanderCall = gsap.delayedCall(gsap.utils.random(1.8, 3.5), wander);
        };
        let wanderCall = gsap.delayedCall(1, wander);
        cleanups.push(() => wanderCall.kill());
      } else {
        let locked: HTMLElement | null = null;
        const onMove = (e: PointerEvent) => {
          if (!locked) lookAt(e.clientX, e.clientY);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onMove));
        const scope = el.closest("section") ?? document;
        scope.querySelectorAll<HTMLElement>("[data-load='cta'] , .h-round-link").forEach((cta) => {
          const enter = () => {
            locked = cta;
            const r = cta.getBoundingClientRect();
            lookAt(r.left + r.width / 2, r.top + r.height / 2);
          };
          const leave = () => (locked = null);
          cta.addEventListener("pointerenter", enter);
          cta.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            cta.removeEventListener("pointerenter", enter);
            cta.removeEventListener("pointerleave", leave);
          });
        });
      }

      const squish = () => {
        gsap.timeline()
          .to(q(".cm-squish"), { scaleX: 1.1, scaleY: 0.88, duration: 0.12, ease: "power2.out", transformOrigin: "50% 95%" })
          .to(q(".cm-squish"), { scaleX: 1, scaleY: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      };
      el.addEventListener("pointerdown", squish);
      cleanups.push(() => el.removeEventListener("pointerdown", squish));

      return () => {
        blinkCall?.kill();
        curiousCall.kill();
        cleanups.forEach((fn) => fn());
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="ctrl-mascot" aria-hidden="true">
      <svg viewBox="0 0 240 230" role="presentation">
        <defs>
          <radialGradient id="cm-fill" gradientUnits="userSpaceOnUse" cx="96" cy="58" r="170">
            <stop offset="0" stopColor="#cdbff0" />
            <stop offset="0.42" stopColor="#9f8ad6" />
            <stop offset="0.8" stopColor="#7461b0" />
            <stop offset="1" stopColor="#4f417f" />
          </radialGradient>
          <radialGradient id="cm-under" cx="50%" cy="70%" r="55%">
            <stop offset="0" stopColor="#2a2048" stopOpacity="0.95" />
            <stop offset="1" stopColor="#2a2048" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cm-hi" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cm-ground" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#000" stopOpacity="0.9" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="cm-clip">
            <Lobes />
          </clipPath>
          <filter id="cm-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="cm-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0" />
          </filter>
        </defs>
        <ellipse className="cm-shadow" cx="122" cy="206" rx="78" ry="9" fill="url(#cm-ground)" />
        <g className="cm-float">
          <g className="cm-tilt">
            <g className="cm-squish">
              <g className="cm-head">
                <g className="cm-body">
                  <g fill="url(#cm-fill)">
                    <Lobes />
                  </g>
                  <g clipPath="url(#cm-clip)">
                    <ellipse cx="122" cy="178" rx="120" ry="40" fill="url(#cm-under)" filter="url(#cm-soft)" />
                    <ellipse cx="104" cy="50" rx="44" ry="20" fill="url(#cm-hi)" filter="url(#cm-soft)" />
                    <rect width="240" height="200" filter="url(#cm-grain)" opacity="0.07" style={{ mixBlendMode: "overlay" }} />
                  </g>
                </g>
                <g className="cm-face" fill="#1d1830">
                  <rect className="cm-eye" x="96" y="94" width="13" height="23" rx="6.5" transform="rotate(-6 102 105)" />
                  <rect className="cm-eye" x="136" y="88" width="15" height="28" rx="7.5" transform="rotate(5 143 102)" />
                  <rect x="117" y="128" width="9" height="4" rx="2" opacity="0.55" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
