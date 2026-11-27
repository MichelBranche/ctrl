"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import type { TeamMember } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { TeamSocials } from "@/components/team-socials";

/** Max tilt in degrees when the pointer reaches the card edge. */
const MAX_TILT = 5;
/** Follow spring while hovering, and the looser one that swings back on leave. */
const FOLLOW = { zeta: 0.62, omega: 11 };
const SETTLE = { zeta: 0.22, omega: 8 };

/** Per-person portrait crop, so faces line up across the badges. */
const FACE: Record<string, string> = {
  "michel-branche": "50% 30%",
  "kallebe-gallo": "50% 28%",
  "matteo-riva": "50% 32%",
  "giulia-moretti": "50% 30%",
  "jacopo-manzalini": "50% 30%",
};

/**
 * A personal badge hanging from an orange lanyard and a swivel carabiner.
 * The <li> and the .tb-hit rect never rotate, so the pointer area stays stable
 * while the .tb-swing group (ribbon + carabiner + card) tilts from the top.
 * Motion is a tiny spring integrated in rAF and written straight to the
 * transform: no React state, no grid re-render.
 */
export function TeamBadge({ member, lang, priority = false }: { member: TeamMember; lang: Locale; priority?: boolean }) {
  const rootRef = useRef<HTMLLIElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const swing = swingRef.current;
    const hit = hitRef.current;
    if (!root || !swing || !hit) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let angle = 0;
    let vel = 0;
    let target = 0;
    let spring = SETTLE;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      const { zeta, omega } = spring;
      vel += (-omega * omega * (angle - target) - 2 * zeta * omega * vel) * dt;
      angle += vel * dt;
      if (Math.abs(angle - target) < 0.005 && Math.abs(vel) < 0.01) {
        angle = target;
        vel = 0;
        raf = 0;
      } else {
        raf = requestAnimationFrame(tick);
      }
      swing.style.transform = angle ? `rotate(${angle.toFixed(3)}deg)` : "";
    };
    const run = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    /** -1 at the left edge of the resting card, +1 at the right edge. */
    const offset = (clientX: number) => {
      const r = hit.getBoundingClientRect();
      return Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width / 2)));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || reduce.matches) return;
      spring = FOLLOW;
      // Pointer on the right pushes the bottom of the card to the right.
      target = -offset(e.clientX) * MAX_TILT;
      run();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      spring = SETTLE;
      target = 0;
      run();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || reduce.matches) return;
      if ((e.target as Element).closest("a")) return;
      // Short impulse, then a free damped swing. No preventDefault: scroll stays free.
      spring = SETTLE;
      target = 0;
      const x = offset(e.clientX);
      vel += (x >= 0 ? -1 : 1) * (24 + 18 * Math.abs(x));
      run();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
    };
  }, []);

  // Only Kallebe's portrait links out. Michel and Jacopo stay unchanged.
  const photoHref = member.slug === "kallebe-gallo" ? member.socials.website : undefined;
  const portrait = member.photo ? (
    <Image
      src={member.photo}
      alt={photoHref ? "" : member.name}
      fill
      sizes="240px"
      quality={90}
      priority={priority}
      style={{ objectPosition: member.photoFocus ?? FACE[member.slug] ?? "50% 30%" } as CSSProperties}
      unoptimized={member.photo.startsWith("http") || member.photo.startsWith("/api/")}
    />
  ) : null;

  return (
    <li ref={rootRef} className="tb">
      <span ref={hitRef} className="tb-hit" aria-hidden="true" />
      <div ref={swingRef} className="tb-swing">
        <span className="tb-ribbon" aria-hidden="true" />
        <Image
          className="tb-clip"
          src="/images/team-badge/carabiner.webp"
          alt=""
          width={220}
          height={453}
          unoptimized
          aria-hidden="true"
        />
        <article className="tb-card" aria-labelledby={`tb-${member.slug}`}>
          <span className="tb-slot" aria-hidden="true" />
          <span className="tb-logo" aria-hidden="true">
            CTRL<sup>®</sup>
          </span>
          <div className="tb-photo">
            {member.photo ? photoHref ? (
              <a
                className="tb-photo-link"
                href={photoHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={lang === "it" ? `Apri il sito di ${member.name}` : `Open ${member.name}'s website`}
              >
                {portrait}
              </a>
            ) : (
              portrait
            ) : null}
          </div>
          <h2 className="tb-name" id={`tb-${member.slug}`}>
            {member.name}
          </h2>
          <p className="tb-role">{member.role[lang]}</p>
          <div className="tb-links">
            <TeamSocials socials={member.socials} name={member.name} lang={lang} />
          </div>
        </article>
      </div>
    </li>
  );
}
