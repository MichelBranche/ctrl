"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowIcon } from "@/components/icons";
import { SwapText } from "@/components/swap-text";
import { Wordmark } from "@/components/wordmark";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const links = [
  { href: "/#work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/#services", label: "Services" },
  { href: "/journal", label: "Journal" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);

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

    const services = document.querySelector("#services");
    if (!services) return;

    ScrollTrigger.create({
      trigger: services,
      start: "top top+=70",
      end: "bottom top+=70",
      onToggle: (self) => bar.classList.toggle("is-ink", self.isActive),
    });
  }, { scope: header });

  useEffect(() => {
    document.documentElement.classList.toggle("nav-open", open);
    return () => document.documentElement.classList.remove("nav-open");
  }, [open]);

  return (
    <header className="site-header" data-header ref={header}>
      <Link href="/" className="logo-link" aria-label="CTRL home">
        <Wordmark />
      </Link>

      <nav className="nav-desktop" aria-label="Primary">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <SwapText>{link.label}</SwapText>
          </Link>
        ))}
      </nav>

      <div className="header-end">
        <span className="magnetic" data-magnetic>
          <Link href="/#contact" className="talk-link" data-cursor="Talk">
            <SwapText>Let&apos;s talk</SwapText>
            <ArrowIcon />
          </Link>
        </span>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" className="nav-mobile" aria-label="Mobile">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <SwapText>{link.label}</SwapText>
            </Link>
          ))}
          <Link href="/#contact" onClick={() => setOpen(false)}>
            Let&apos;s talk
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
