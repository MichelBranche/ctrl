"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CtrlMark } from "@/components/letter-hover";
import { useLocale } from "@/components/use-locale";
import { CONTACT_EMAIL } from "@/lib/content";
import type { SocialKey, SocialLink } from "@/lib/settings-types";
import "./site-footer.css";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

function Arrow() {
  return (
    <svg className="h-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

const ICONS: Partial<Record<SocialKey, ReactNode>> = {
  linkedin: (
      <path d="M4 9h3v11H4zM5.5 4a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 9h2.9v1.5h.1c.4-.8 1.4-1.7 3-1.7 3.1 0 3.7 2 3.7 4.7V20h-3v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20h-3z" fill="currentColor" />
  ),
  instagram: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17" cy="7" r=".6" fill="currentColor" />
      </g>
  ),
  behance: (
      <path d="M3 6h5.2c2 0 3.3 1 3.3 2.7 0 1.1-.6 1.9-1.5 2.3 1.3.3 2 1.3 2 2.7 0 2-1.6 3.3-3.8 3.3H3zm2.4 2v2.6h2.5c.9 0 1.4-.5 1.4-1.3S8.8 8 7.9 8zm0 4.5v3h2.8c1 0 1.6-.6 1.6-1.5s-.6-1.5-1.6-1.5zM14.5 7h5v1.3h-5zm2.6 2.4c2.4 0 3.8 1.7 3.6 4.3h-5.4c.1 1.3.9 2 2 2 .8 0 1.3-.4 1.6-.9h1.7c-.5 1.5-1.7 2.4-3.4 2.4-2.3 0-3.7-1.6-3.7-3.9s1.5-3.9 3.6-3.9zm-1.7 3h3.4c-.1-1-.7-1.6-1.7-1.6s-1.6.6-1.7 1.6z" fill="currentColor" />
  ),
};

/** Closing footer shared by the home page and every inner page. */
export function SiteFooterView({ socials }: { socials: SocialLink[] }) {
  const root = useRef<HTMLElement>(null);
  const { t, lang } = useLocale();
  const h = t.home;

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(scope.querySelectorAll("[data-mask]"), { y: "0%" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const title = scope.querySelector<HTMLElement>(".h-close-title [data-mask]");
        let split: SplitText | undefined;
        if (title) {
          split = SplitText.create(title, { type: "words", wordsClass: "h-word" });
          gsap.set(title, { y: "0%" });
          gsap.fromTo(
            split.words,
            { yPercent: 115, rotate: 3 },
            {
              yPercent: 0,
              rotate: 0,
              duration: 1.1,
              stagger: 0.06,
              ease: "power4.out",
              scrollTrigger: { trigger: title, start: "top 90%" },
            },
          );
          gsap.fromTo(split.words, { opacity: 0.15 }, {
            opacity: 1,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: { trigger: scope, start: "top 75%", end: "top 30%", scrub: true },
          });
        }

        const vline = scope.querySelector(".h-vline");
        if (vline) {
          gsap.fromTo(vline, { scaleY: 0 }, {
            scaleY: 1,
            transformOrigin: "50% 0",
            ease: "none",
            scrollTrigger: { trigger: vline, start: "top 85%", end: "bottom 60%", scrub: true },
          });
        }

        gsap.fromTo(".h-mark", { yPercent: 25, opacity: 0 }, {
          yPercent: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: scope, start: "top 90%", end: "top 40%", scrub: true },
        });
        gsap.fromTo(".h-circle-lg", { scale: 0.4, rotate: -90 }, {
          scale: 1,
          rotate: 0,
          ease: "back.out(1.6)",
          duration: 1.1,
          scrollTrigger: { trigger: ".h-circle-lg", start: "top 92%" },
        });
        gsap.fromTo(".h-socials li", { y: 20, opacity: 0 }, {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: ".h-socials", start: "top 95%" },
        });

        return () => split?.revert();
      });
    },
    { scope: root },
  );

  return (
    <footer className="h-close" id="contact" ref={root}>
      <i className="h-dot" aria-hidden="true" />
      <CtrlMark className="h-mark" />
      <div className="h-close-info">
        <p className="h-small h-close-kicker">
          <span>{h.closeKicker[0]}</span>
          <span>{h.closeKicker[1]}</span>
        </p>
        <p className="h-close-lead">{h.closeLead}</p>
        <p className="h-small h-close-kicker">
          <span>{h.location}</span>
          <span>© 2026 CTRL®</span>
        </p>
        {socials.length ? (
          <ul className="h-socials">
            {socials.map((s) => (
              <li key={s.key}>
                <a className="h-small" href={s.url} target="_blank" rel="noopener noreferrer me">
                  {ICONS[s.key] ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {ICONS[s.key]}
                    </svg>
                  ) : null}
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="h-small h-legal">
          <a href={lang === "en" ? "/en/privacy" : "/privacy"}>Privacy</a>
          <a href={lang === "en" ? "/en/cookies" : "/cookie"}>Cookie</a>
        </p>
      </div>
      <h2 className="h-close-title">
        <span className="line-mask">
          <span data-mask="footer">{h.closeTitle}</span>
        </span>
      </h2>
      <i className="h-vline" aria-hidden="true" />
      <a href={`mailto:${CONTACT_EMAIL}`} className="h-circle h-circle-lg" aria-label={h.closeCta}>
        <Arrow />
      </a>
    </footer>
  );
}
