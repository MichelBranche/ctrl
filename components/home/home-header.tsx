"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SwapText } from "@/components/swap-text";
import { Wordmark } from "@/components/wordmark";
import { LangSwitch } from "@/components/lang-switch";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useLocale } from "@/components/use-locale";
import { localize } from "@/lib/i18n";
import { UI_SPRING, springLinear } from "./springs";

/** Scroll distance (px) after which the bar turns into the floating pill (reference: ~5-10px). */
const PILL_AT = 8;
/** Hover intent before a dropdown opens and grace before it closes (reference: ~50ms each). */
const OPEN_DELAY = 50;
const CLOSE_DELAY = 50;
/** Row stagger (s): every row drops 100ms after the previous one, across blocks; a block starts with its first row. */
const ROW_STAGGER = 0.1;

const SPRING_CSS = springLinear(UI_SPRING);

export type NavItem = { label: string; href: string };
export type NavMenu = { id: string; label: string; groups: NavItem[][] };

function Arrow() {
  return (
    <svg className="hn-sub-arrow" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Distance from the arrow's resting spot (after the label) to the row's right edge. */
function measureShift(row: HTMLElement) {
  const label = row.querySelector<HTMLElement>(".hn-sub-label");
  const arrow = row.querySelector<HTMLElement>(".hn-sub-arrow");
  if (!label || !arrow) return;
  const style = getComputedStyle(row);
  const inner = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const used = label.offsetWidth + parseFloat(style.columnGap || "0") + arrow.getBoundingClientRect().width;
  row.style.setProperty("--hn-shift", `${Math.max(0, inner - used)}px`);
}

/**
 * Home-only header. A transparent bar inside the hero card that springs into a
 * centred, blurred pill after the first pixels of scroll and stays fixed.
 * Progetti, Servizi and Altro open stacked blocks that drop in one after the
 * other (hover, click or keyboard; Esc closes). Inner pages keep SiteHeader.
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

  const enter = (id: string) => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenu(id), OPEN_DELAY);
  };
  const leave = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenu(null), CLOSE_DELAY);
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
      <div
        id={`hn-sub-${m.id}`}
        className="hn-sub"
        data-open={menu === m.id ? "" : undefined}
        inert={menu !== m.id}
        onPointerOver={(event) => {
          const row = (event.target as HTMLElement).closest<HTMLElement>(".hn-sub-item");
          if (row) measureShift(row);
        }}
        onFocus={(event) => {
          const row = (event.target as HTMLElement).closest<HTMLElement>(".hn-sub-item");
          if (row) measureShift(row);
        }}
      >
        {m.groups.map((group, index) => {
          const first = m.groups.slice(0, index).reduce((sum, g) => sum + g.length, 0);
          return (
            <ul key={index} className="hn-group" style={{ "--d": `${first * ROW_STAGGER}s` } as React.CSSProperties}>
              {group.map((item, row) => (
                <li key={item.href} style={{ "--d": `${(first + row) * ROW_STAGGER}s` } as React.CSSProperties}>
                  <Link href={item.href} className="hn-sub-item" onClick={() => setMenu(null)}>
                    <span className="hn-sub-label">{item.label}</span>
                    <Arrow />
                  </Link>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </div>
  );

  return (
    <header
      className="hn"
      data-pill={pill ? "" : undefined}
      data-header
      style={{ "--hn-spring": SPRING_CSS } as React.CSSProperties}
    >
      <div className="hn-bar">
        <div className="hn-row">
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
      </div>

      {open ? (
        <nav id="hn-mobile" className="nav-mobile hn-mobile" aria-label="Mobile">
          {menus.map((m) => (
            <div key={m.id} className="hn-mobile-group">
              <p className="hn-mobile-label">{m.label}</p>
              {m.groups.flat().map((item) => (
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
