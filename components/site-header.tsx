"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SwapText } from "@/components/swap-text";
import { Wordmark } from "@/components/wordmark";
import { LangSwitch } from "@/components/lang-switch";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/use-locale";
import { localize } from "@/lib/i18n";
import { CONTACT_EMAIL } from "@/lib/content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const { lang, t } = useLocale();
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => !href.includes("#") && href !== "/" && (pathname === href || pathname.startsWith(`${href}/`));
  const links = [
    { href: localize("/#work", lang), label: t.nav.work },
    { href: localize("/services", lang), label: t.nav.services },
    { href: localize("/about", lang), label: t.nav.about },
    { href: localize("/team", lang), label: t.nav.team },
    { href: localize("/journal", lang), label: t.nav.journal },
    { href: localize("/contact", lang), label: t.nav.contact },
  ];

  useGSAP(() => {
    const bar = header.current;
    if (!bar) return;

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const menu = document.documentElement.classList.contains("nav-open");
        const y = self.scroll();
        bar.classList.toggle("is-solid", y > 24 && !menu);
        bar.classList.toggle("is-hidden", !menu && y > 180 && self.direction === 1);
      },
    });

  }, { scope: header });

  useEffect(() => {
    document.documentElement.classList.toggle("nav-open", open);
    return () => document.documentElement.classList.remove("nav-open");
  }, [open]);

  return (
    <header className="site-header" data-header ref={header}>
      <Link href={localize("/", lang)} className="logo-link" aria-label="CTRL home">
        <Wordmark />
      </Link>

      <nav className="nav-desktop" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={isActive(link.href) ? "is-active" : undefined}
          >
            <SwapText>{link.label}</SwapText>
          </Link>
        ))}
      </nav>

      <div className="header-end">
        <button
          type="button"
          className="cmd-trigger mono"
          aria-label={t.cmd.open}
          onClick={() => window.dispatchEvent(new Event("ctrl:command"))}
        >
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </button>
        <LangSwitch />
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t.close : t.menu}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" className="nav-mobile" aria-label="Mobile">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <SwapText>{link.label}</SwapText>
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} onClick={() => setOpen(false)}>
            {t.cta}
          </a>
        </nav>
      ) : null}
    </header>
  );
}
