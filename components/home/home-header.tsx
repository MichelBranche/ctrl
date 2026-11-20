"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SwapText } from "@/components/swap-text";
import { Wordmark } from "@/components/wordmark";
import { LangSwitch } from "@/components/lang-switch";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useLocale } from "@/components/use-locale";
import { localize } from "@/lib/i18n";

/** Scroll distance (px) after which the full-width bar turns into the floating pill. */
const PILL_AT = 96;

export type NavItem = { label: string; href: string };
export type NavMenu = { id: string; label: string; href?: string; items: NavItem[] };

/**
 * Submenu motion. The Work Louder mirror only ships the SSR markup, not the
 * runtime that animates its dropdown, so these numbers are estimated from the
 * reference capture: separate pills dropping in with a short stagger.
 */
const MENU_IN = { duration: 0.45, stagger: 0.035, y: -10, blur: 6, ease: "back.out(1.4)" };

function Arrow() {
  return (
    <svg className="hn-sub-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Home-only header. A clean bar over the hero that becomes a floating, blurred
 * pill once the visitor scrolls. Progetti, Servizi and Altro open a stack of
 * separate pills under the bar (hover, click or keyboard; Esc closes).
 * Inner pages keep SiteHeader untouched.
 */
export function HomeHeader({ menus }: { menus: NavMenu[] }) {
  const { lang, t } = useLocale();
  const [pill, setPill] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const simple = [
    { href: localize("/shop", lang), label: t.nav.shop },
    { href: localize("/team", lang), label: t.nav.team },
  ];

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

  const close = useCallback((focusButton = false) => {
    setMenu((current) => {
      if (focusButton && current) navRef.current?.querySelector<HTMLButtonElement>(`[aria-controls="hn-sub-${current}"]`)?.focus();
      return null;
    });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, close]);

  // Pills drop in one after the other.
  useEffect(() => {
    if (!menu) return;
    const items = navRef.current?.querySelectorAll<HTMLElement>(`#hn-sub-${menu} .hn-sub-item`);
    if (!items?.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: MENU_IN.y, filter: `blur(${MENU_IN.blur}px)` },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: MENU_IN.duration, stagger: MENU_IN.stagger, ease: MENU_IN.ease, clearProps: "filter,transform" },
    );
    return () => {
      tween.kill();
    };
  }, [menu]);

  const enter = (id: string) => {
    window.clearTimeout(closeTimer.current);
    setMenu(id);
  };
  const leave = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenu(null), 140);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const renderMenu = (m: NavMenu) => (
    <div key={m.id} className="hn-more" onMouseEnter={() => enter(m.id)} onMouseLeave={leave}>
      <button
        type="button"
        className="hn-link hn-more-btn"
        aria-expanded={menu === m.id}
        aria-controls={`hn-sub-${m.id}`}
        onClick={() => setMenu((value) => (value === m.id ? null : m.id))}
      >
        {m.label}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      <ul id={`hn-sub-${m.id}`} className="hn-sub" hidden={menu !== m.id}>
        {m.items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="hn-sub-item" onClick={() => setMenu(null)}>
              <span>{item.label}</span>
              <Arrow />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <header className="hn" data-pill={pill ? "" : undefined} data-header>
      <div className="hn-bar">
        <Link href={localize("/", lang)} className="hn-logo" aria-label="CTRL home">
          <Wordmark />
        </Link>

        <nav className="hn-links" aria-label="Primary" ref={navRef}>
          {menus.filter((m) => m.id !== "more").map(renderMenu)}
          {simple.map((link) => (
            <Link key={link.href} href={link.href} className="hn-link">
              <SwapText>{link.label}</SwapText>
            </Link>
          ))}
          {menus.filter((m) => m.id === "more").map(renderMenu)}
        </nav>

        <div className="hn-end">
          <LangSwitch className="hn-lang" />
          <span className="hn-cart">
            <CartDrawer lang={lang} />
          </span>
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
          {menus.map((m) => (
            <div key={m.id} className="hn-mobile-group">
              <p className="hn-mobile-label">{m.label}</p>
              {m.items.map((item) => (
                <Link key={item.href} href={item.href} className="hn-mobile-sub" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          {simple.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <LangSwitch className="hn-mobile-lang" />
        </nav>
      ) : null}
    </header>
  );
}
