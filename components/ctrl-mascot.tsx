"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * "Kappa": the CTRL® keycap creature. A squishy keycap with a curly
 * USB-cable antenna, stubby feet and two cursor-tracking eyes.
 */
export function CtrlMascot({ lang }: { lang: "it" | "en" | string }) {
  const root = useRef<HTMLDivElement>(null);
  const hello = lang === "it" ? "ciao!" : "hi!";

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const body = q(".m-body")[0];
      const tilt = q(".m-tilt")[0];
      const lids = q(".m-lid");
      const pupils = q(".m-pupils")[0];
      const smile = q(".m-smile")[0];
      const happy = q(".m-happy")[0];
      const bubble = q(".m-bubble")[0];
      const antenna = q(".m-antenna")[0];
      const plug = q(".m-plug")[0];

      gsap.set([body, tilt], { transformOrigin: "50% 100%" });
      gsap.set(lids, { scaleY: 0, transformOrigin: "50% 0%" });
      gsap.set(antenna, { transformOrigin: "50% 100%" });
      gsap.set([happy, bubble], { autoAlpha: 0 });
      gsap.set(bubble, { transformOrigin: "0% 100%" });

      // Blinks (also under reduced motion)
      let blinkCall: gsap.core.Tween | null = null;
      const blink = () => {
        const tl = gsap.timeline();
        tl.to(lids, { scaleY: 1, duration: 0.07, ease: "power2.in" }).to(lids, {
          scaleY: 0,
          duration: 0.12,
          ease: "power2.out",
        });
        if (Math.random() < 0.25) tl.to(lids, { scaleY: 1, duration: 0.06, delay: 0.08 }).to(lids, { scaleY: 0, duration: 0.12 });
        blinkCall = gsap.delayedCall(gsap.utils.random(2, 6), blink);
      };
      blinkCall = gsap.delayedCall(1.5, blink);

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Entrance + breathing
        gsap.from(el, { yPercent: 40, autoAlpha: 0, duration: 1.2, delay: 0.9, ease: "back.out(1.6)" });
        gsap.to(body, { scaleY: 1.035, scaleX: 0.975, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(tilt, { y: -10, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(antenna, { rotation: 8, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 100%" });
        gsap.to(plug, { opacity: 0.45, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });

        const px = gsap.quickTo(pupils, "x", { duration: 0.35, ease: "power3" });
        const py = gsap.quickTo(pupils, "y", { duration: 0.35, ease: "power3" });
        const rot = gsap.quickTo(tilt, "rotation", { duration: 0.8, ease: "power3" });

        const look = (cx: number, cy: number) => {
          const r = el.getBoundingClientRect();
          const dx = cx - (r.left + r.width / 2);
          const dy = cy - (r.top + r.height * 0.45);
          const a = Math.atan2(dy, dx);
          const d = Math.min(1, Math.hypot(dx, dy) / 400);
          px(Math.cos(a) * 9 * d);
          py(Math.sin(a) * 7 * d);
          rot(gsap.utils.clamp(-9, 9, dx / 60));
        };

        // Anchor for idle look-around (touch)
        const fine = window.matchMedia("(pointer: fine)").matches;
        let idle: gsap.core.Tween | null = null;
        if (!fine) {
          const wander = () => {
            px(gsap.utils.random(-9, 9));
            py(gsap.utils.random(-6, 6));
            idle = gsap.delayedCall(gsap.utils.random(1.2, 3), wander);
          };
          wander();
        }

        let last = { x: 0, y: 0, t: 0 };
        let startled = false;
        const onMove = (e: PointerEvent) => {
          look(e.clientX, e.clientY);
          const t = performance.now();
          const v = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(1, t - last.t);
          last = { x: e.clientX, y: e.clientY, t };
          if (v > 4 && !startled) {
            startled = true;
            gsap.timeline({ onComplete: () => void (startled = false) })
              .to(body, { scaleX: 1.12, scaleY: 0.86, duration: 0.12, ease: "power2.out", overwrite: "auto" })
              .to(body, { scaleX: 1, scaleY: 1, duration: 0.7, ease: "elastic.out(1, 0.35)" })
              .to({}, { duration: 0.4 });
          }
        };
        if (fine) window.addEventListener("pointermove", onMove, { passive: true });

        // CTA hover: happy squint + hop toward button
        const cta = el.closest("section")?.querySelector<HTMLElement>(".h-round-link");
        const onEnter = () => {
          if (cta) {
            const r = cta.getBoundingClientRect();
            look(r.left + r.width / 2, r.top + r.height / 2);
          }
          gsap.to(happy, { autoAlpha: 1, duration: 0.15 });
          gsap.to(q(".m-eyes"), { autoAlpha: 0, duration: 0.15 });
          gsap.fromTo(tilt, { y: 0 }, { y: -26, duration: 0.22, yoyo: true, repeat: 3, ease: "power2.out" });
        };
        const onLeave = () => {
          gsap.to(happy, { autoAlpha: 0, duration: 0.2 });
          gsap.to(q(".m-eyes"), { autoAlpha: 1, duration: 0.2 });
        };
        cta?.addEventListener("pointerenter", onEnter);
        cta?.addEventListener("pointerleave", onLeave);

        // Click boing + bubble
        const onClick = () => {
          gsap.timeline()
            .to(body, { scaleY: 0.72, scaleX: 1.22, duration: 0.12, ease: "power2.in", overwrite: "auto" })
            .to(body, { scaleY: 1.18, scaleX: 0.88, duration: 0.16, ease: "power2.out" })
            .to(body, { scaleY: 1, scaleX: 1, duration: 0.9, ease: "elastic.out(1.1, 0.3)" });
          gsap.timeline()
            .fromTo(bubble, { autoAlpha: 0, scale: 0.4, y: 10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(2.5)" })
            .to(bubble, { autoAlpha: 0, y: -8, duration: 0.3, delay: 1.2 });
          gsap.fromTo(smile, { scaleY: 1 }, { scaleY: 1.6, duration: 0.2, yoyo: true, repeat: 1, transformOrigin: "50% 0%" });
        };
        el.addEventListener("click", onClick);

        // Scroll: peek / tilt / parallax
        const hero = el.closest("section");
        const st = gsap.to(el, {
          yPercent: -35,
          rotation: -12,
          ease: "none",
          scrollTrigger: { trigger: hero ?? el, start: "top top", end: "bottom top", scrub: 0.6 },
        });

        return () => {
          window.removeEventListener("pointermove", onMove);
          cta?.removeEventListener("pointerenter", onEnter);
          cta?.removeEventListener("pointerleave", onLeave);
          el.removeEventListener("click", onClick);
          idle?.kill();
          st.scrollTrigger?.kill();
        };
      });

      return () => {
        blinkCall?.kill();
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <div className="h-mascot" ref={root} aria-hidden="true">
      <svg viewBox="0 0 260 300" className="h-mascot-svg">
        <defs>
          <linearGradient id="mk-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a2f" />
            <stop offset=".55" stopColor="#ff4a1c" />
            <stop offset="1" stopColor="#e5157a" />
          </linearGradient>
          <linearGradient id="mk-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb25a" />
            <stop offset=".6" stopColor="#ff6a2a" />
            <stop offset="1" stopColor="#ff3d6e" />
          </linearGradient>
          <radialGradient id="mk-gloss" cx=".3" cy=".2" r=".6">
            <stop offset="0" stopColor="#fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="m-tilt">
          <g className="m-body">
          {/* Cable antenna with glowing plug */}
          <g className="m-antenna">
            <path d="M150 104 C150 70 176 70 170 52 C164 36 140 44 146 28 C150 18 162 16 168 14" fill="none" stroke="#1b1b1b" strokeWidth="5" strokeLinecap="round" />
            <rect x="160" y="2" width="18" height="14" rx="3" fill="#2a2a2a" />
            <rect className="m-plug" x="164" y="5" width="10" height="5" rx="1.5" fill="#ffb25a" />
          </g>
            {/* feet */}
            <ellipse cx="92" cy="272" rx="22" ry="12" fill="#c8124f" />
            <ellipse cx="168" cy="272" rx="22" ry="12" fill="#c8124f" />
            {/* keycap skirt */}
            <path d="M28 120 Q30 92 58 90 L202 90 Q230 92 232 120 L238 240 Q238 268 210 268 L50 268 Q22 268 22 240 Z" fill="url(#mk-side)" />
            {/* top face (dished) */}
            <path d="M58 100 Q60 86 76 86 L184 86 Q200 86 202 100 L210 214 Q210 232 192 232 L68 232 Q50 232 50 214 Z" fill="url(#mk-top)" />
            <ellipse cx="96" cy="118" rx="54" ry="30" fill="url(#mk-gloss)" />
            <text x="66" y="112" fontSize="14" fontFamily="var(--font-geist-mono, monospace)" fill="#5a1200" opacity=".7" letterSpacing="1">ctrl</text>
            {/* eyes */}
            <g className="m-eyes">
              <ellipse cx="102" cy="160" rx="22" ry="25" fill="#fff" />
              <ellipse cx="158" cy="160" rx="22" ry="25" fill="#fff" />
              <g className="m-pupils">
                <circle cx="102" cy="162" r="10" fill="#111" />
                <circle cx="158" cy="162" r="10" fill="#111" />
                <circle cx="106" cy="157" r="3.2" fill="#fff" />
                <circle cx="162" cy="157" r="3.2" fill="#fff" />
              </g>
              <ellipse className="m-lid" cx="102" cy="148" rx="23" ry="26" fill="#ff7032" />
              <ellipse className="m-lid" cx="158" cy="148" rx="23" ry="26" fill="#ff6a3a" />
            </g>
            <g className="m-happy" fill="none" stroke="#2a0a00" strokeWidth="5" strokeLinecap="round">
              <path d="M84 166 Q102 146 120 166" />
              <path d="M140 166 Q158 146 176 166" />
            </g>
            {/* cheeks + smile */}
            <ellipse cx="76" cy="196" rx="11" ry="6" fill="#ff2f73" opacity=".55" />
            <ellipse cx="184" cy="196" rx="11" ry="6" fill="#ff2f73" opacity=".55" />
            <path className="m-smile" d="M118 196 Q130 210 142 196" fill="#2a0a00" stroke="#2a0a00" strokeWidth="3" strokeLinejoin="round" />
          </g>
          <g className="m-bubble">
            <rect x="196" y="40" width="62" height="34" rx="17" fill="#f4f1ea" />
            <path d="M206 70 L200 86 L218 72 Z" fill="#f4f1ea" />
            <text x="227" y="63" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0c0c0c" fontFamily="var(--font-display, sans-serif)">{hello}</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
