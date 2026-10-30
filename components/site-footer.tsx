"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowIcon } from "@/components/icons";
import { SwapText } from "@/components/swap-text";
import { CurrentYear, LocalClock } from "@/components/local-clock";
import { useLocale } from "@/components/use-locale";
import { CONTACT_EMAIL } from "@/lib/content";
import { localize } from "@/lib/i18n";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function SiteFooter() {
  const footer = useRef<HTMLElement>(null);
  const shift = useRef<HTMLDivElement>(null);
  const { lang, t } = useLocale();
  const f = t.footer;
  const links = [
    { href: localize("/#work", lang), label: t.nav.work },
    { href: localize("/about", lang), label: t.nav.about },
    { href: localize("/#services", lang), label: t.nav.services },
    { href: localize("/journal", lang), label: t.nav.journal },
  ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const glyphs = gsap.utils.toArray<HTMLElement>(".footer-glyph i");
        if (glyphs.length) {
          gsap.fromTo(
            glyphs,
            { y: "115%" },
            {
              y: "0%",
              ease: "none",
              stagger: 0.06,
              scrollTrigger: {
                trigger: ".footer-mark",
                start: "top bottom",
                end: "bottom bottom",
                scrub: 0.6,
              },
            },
          );
        }

        const line = footer.current?.querySelector<HTMLElement>(
          "[data-mask='footer']",
        );
        if (line) {
          gsap.fromTo(
            line,
            { y: "120%" },
            {
              y: "0%",
              duration: 1.15,
              ease: "power4.out",
              scrollTrigger: { trigger: line, start: "top 92%" },
            },
          );
        }

        const mark = footer.current?.querySelector<HTMLElement>(".footer-mark sup");
        if (mark) {
          gsap.fromTo(
            mark,
            { opacity: 0 },
            {
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: ".footer-mark",
                start: "top bottom",
                end: "bottom bottom",
                scrub: true,
              },
            },
          );
        }

        gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 28, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 92%" },
              onComplete: () => gsap.set(el, { clearProps: "opacity" }),
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-draw]").forEach((el) => {
          gsap.fromTo(
            el,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.15,
              ease: "power3.inOut",
              scrollTrigger: { trigger: el, start: "top 90%" },
            },
          );
        });

        if (!shift.current) return;
        const skew = gsap.quickTo(shift.current, "skewX", {
          duration: 0.7,
          ease: "power3.out",
        });
        const onScroll = () => {
          const velocity = window.__lenis?.velocity ?? 0;
          skew(gsap.utils.clamp(-7, 7, velocity * 0.018));
        };
        window.__lenis?.on("scroll", onScroll);
        return () => window.__lenis?.off("scroll", onScroll);
      });
    },
    { scope: footer },
  );

  return (
    <footer id="contact" className="contact" ref={footer}>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-shift" ref={shift}>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div className="marquee-group" key={copy}>
                {f.ticker.map((item) => (
                  <span key={`${copy}-${item}`}>
                    {item}
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="contact-main">
        <p className="kicker" data-rise>
          {f.kicker}
        </p>
        <h2 className="contact-title">
          <span className="magnetic" data-magnetic>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              data-cursor="Mail"
            >
              <span className="line-mask">
                <span data-mask="footer">{f.title}</span>
              </span>
              <ArrowIcon />
            </a>
          </span>
        </h2>
        <p className="contact-lead" data-rise>
          {f.lead}
        </p>
        <a className="cta-button" href={`mailto:${CONTACT_EMAIL}`} data-rise data-cursor="Mail">
          <span>{t.cta}</span>
          <ArrowIcon />
        </a>
        <span className="draw-rule" data-draw />
      </div>

      <div className="contact-grid">
        <div className="contact-block" data-rise>
          <p className="kicker">{f.studio}</p>
          <p className="contact-strong">{f.independent}</p>
          <p>{f.available}</p>
          <p className="clock">
            <LocalClock />
            {f.localTime}
          </p>
        </div>

        <nav className="contact-block" data-rise aria-label="Footer">
          <p className="kicker">{f.index}</p>
          <div className="contact-index">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <SwapText>{link.label}</SwapText>
              </Link>
            ))}
          </div>
        </nav>

        <div className="contact-block" data-rise>
          <p className="kicker">{f.contact}</p>
          <a className="mail-link" href={`mailto:${CONTACT_EMAIL}`} data-cursor="Mail">
            {CONTACT_EMAIL}
          </a>
          <span className="magnetic" data-magnetic>
            <button
              type="button"
              className="top-link"
              data-cursor="Top"
              onClick={() => {
                if (window.__lenis) window.__lenis.scrollTo(0);
                else window.scrollTo({ top: 0 });
              }}
            >
              <SwapText>{f.top}</SwapText>
              <ArrowIcon />
            </button>
          </span>
        </div>
      </div>

      <div className="contact-meta">
        <span>© <CurrentYear /> CTRL®</span>
        <span>{f.tagline}</span>
      </div>

      <div className="footer-mark" aria-hidden="true">
        {"CTRL".split("").map((letter) => (
          <span className="footer-glyph" key={letter}>
            <i>{letter}</i>
          </span>
        ))}
        <sup>®</sup>
      </div>
    </footer>
  );
}
