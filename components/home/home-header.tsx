"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SwapText } from "@/components/swap-text";
import { Wordmark } from "@/components/wordmark";
import { LangSwitch } from "@/components/lang-switch";
import { useLocale } from "@/components/use-locale";
import { localize } from "@/lib/i18n";

/** Scroll distance (px) after which the full-width bar turns into the floating pill. */
const PILL_AT = 96;

/**
 * Home-only header. A clean bar over the hero that becomes a floating, blurred
 * pill once the visitor scrolls. Inner pages keep SiteHeader untouched.
 */
export function HomeHeader() {
  const { lang, t } = useLocale();
  const h = t.home;
  const [pill, setPill] = useState(false);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const main = [
    { href: localize("/projects", lang), label: t.nav.work },
    { href: localize("/services", lang), label: t.nav.services },
    { href: localize("/team", lang), label: t.nav.team },
  ];
  const extra = [
    { href: localize("/journal", lang), label: t.nav.journal },
    { href: localize("/shop", lang), label: t.nav.shop },
    { href: localize("/contact", lang), label: t.nav.contact },
  ];
  const talk = localize("/bookings", lang);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setPill(window.scrollY > PILL_AT);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("nav-open", open);
    return () => document.documentElement.classList.remove("nav-open");
  }, [open]);

  useEffect(() => {
    if (!more) return;
    const onDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMore(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMore(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [more]);

  return (
    <header className="hn" data-pill={pill ? "" : undefined} data-header>
      <div className="hn-bar">
        <Link href={localize("/", lang)} className="hn-logo" aria-label="CTRL home">
          <Wordmark />
        </Link>

        <nav className="hn-links" aria-label="Primary">
          {main.map((link) => (
            <Link key={link.href} href={link.href} className="hn-link">
              <SwapText>{link.label}</SwapText>
            </Link>
          ))}
          <div className="hn-more" ref={moreRef} onMouseLeave={() => setMore(false)}>
            <button
              type="button"
              className="hn-link hn-more-btn"
              aria-expanded={more}
              aria-controls="hn-more-menu"
              onClick={() => setMore((value) => !value)}
              onMouseEnter={() => setMore(true)}
            >
              {h.navMore}
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
            <div id="hn-more-menu" className="hn-menu" data-open={more ? "" : undefined} hidden={!more}>
              {extra.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMore(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="hn-end">
          <LangSwitch className="hn-lang" />
          <Link href={talk} className="hn-talk">
            {h.navTalk}
          </Link>
          <button
            type="button"
            className="hn-toggle"
            aria-expanded={open}
            aria-controls="hn-mobile"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? t.close : t.menu}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="hn-mobile" className="nav-mobile hn-mobile" aria-label="Mobile">
          {[...main, ...extra].map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href={talk} className="hn-mobile-talk" onClick={() => setOpen(false)}>
            {h.navTalk}
          </Link>
          <LangSwitch className="hn-mobile-lang" />
        </nav>
      ) : null}
    </header>
  );
}
