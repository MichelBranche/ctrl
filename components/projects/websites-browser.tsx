"use client";

// Hover-reveal list: rows of type, the project image follows the cursor only on hover.
// Pattern from Hover.dev "Hover Image Links" and Skiper UI skiper6 (already used on the home).
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PArrow } from "@/components/projects/arrow";
import type { ProjectAuthor } from "@/lib/content";
import { scheduleRefresh } from "@/lib/refresh";

gsap.registerPlugin(ScrollTrigger);

export type SiteRow = {
  slug: string;
  href: string;
  group: string;
  groupLabel: string;
  title: string;
  place: string;
  year?: string;
  image: string;
  author?: ProjectAuthor;
};

export type SitesCopy = {
  filterLabel: string;
  filterAll: string;
  madeBy: string;
  portfolioTab: string;
  open: string;
};

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const num = (i: number) => String(i + 1).padStart(2, "0");

export function WebsitesBrowser({ items, groups, copy }: { items: SiteRow[]; groups: { slug: string; label: string }[]; copy: SitesCopy }) {
  const [filter, setFilter] = useState("all");
  const [armed, setArmed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const filters = useRef<HTMLUListElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const changed = useRef(false);
  const mover = useRef<{ x: (v: number) => void; y: (v: number) => void; r: (v: number) => void } | null>(null);
  const last = useRef({ x: 0, t: 0 });

  const moveBox = useCallback((instant = false) => {
    const el = filters.current?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!el || !box.current) return;
    gsap.to(box.current, { x: el.offsetLeft, width: el.offsetWidth, autoAlpha: 1, duration: instant || reduced() ? 0 : 0.55, ease: "power3.inOut", overwrite: true });
  }, []);

  useEffect(() => {
    moveBox(true);
    const onResize = () => moveBox(true);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => moveBox(true));
    return () => window.removeEventListener("resize", onResize);
  }, [moveBox]);

  // First reveal: rows rise in once, as the list enters the viewport. Final state is always cleared.
  useEffect(() => {
    const rows = list.current?.querySelectorAll<HTMLElement>("[data-w-row]");
    if (!rows?.length || reduced()) return;
    gsap.set(rows, { autoAlpha: 0, y: 18 });
    const st = ScrollTrigger.create({
      trigger: list.current,
      start: "top 88%",
      once: true,
      onEnter: () => gsap.to(rows, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.045, clearProps: "opacity,visibility,transform" }),
    });
    return () => st.kill();
  }, []);

  // Filter change: rows stay in normal flow (no absolute positioning), so nothing can overlap; the visible set just re-staggers in.
  useLayoutEffect(() => {
    moveBox();
    if (!changed.current || !list.current) return;
    changed.current = false;
    const rows = list.current.querySelectorAll<HTMLElement>("[data-w-row]:not([hidden])");
    gsap.killTweensOf(list.current.querySelectorAll("[data-w-row]"));
    gsap.set(list.current.querySelectorAll("[data-w-row]"), { clearProps: "opacity,visibility,transform" });
    if (!reduced()) gsap.fromTo(rows, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.04, clearProps: "opacity,visibility,transform" });
    scheduleRefresh();
  }, [filter, moveBox]);

  const pick = (value: string) => {
    if (value === filter) return;
    changed.current = true;
    setActive(null);
    setFilter(value);
  };

  const ensureMover = () => {
    if (mover.current || !preview.current) return mover.current;
    const fast = reduced();
    mover.current = {
      x: gsap.quickTo(preview.current, "x", { duration: fast ? 0 : 0.55, ease: "power3.out" }),
      y: gsap.quickTo(preview.current, "y", { duration: fast ? 0 : 0.55, ease: "power3.out" }),
      r: gsap.quickTo(preview.current, "rotation", { duration: fast ? 0 : 0.6, ease: "power3.out" }),
    };
    return mover.current;
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const m = ensureMover();
    if (!m) return;
    m.x(e.clientX);
    m.y(e.clientY);
    const now = e.timeStamp;
    const v = (e.clientX - last.current.x) / Math.max(now - last.current.t, 1);
    last.current = { x: e.clientX, t: now };
    if (!reduced()) m.r(gsap.utils.clamp(-8, 8, v * 6));
  };

  const show = (slug: string, e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || !finePointer()) return;
    if (!armed) setArmed(true);
    const m = ensureMover();
    if (m && !active) {
      gsap.set(preview.current, { x: e.clientX, y: e.clientY });
    }
    setActive(slug);
  };

  useEffect(() => {
    if (!preview.current) return;
    const on = active !== null;
    gsap.to(preview.current, {
      autoAlpha: on ? 1 : 0,
      scale: on || reduced() ? 1 : 0.7,
      duration: reduced() ? 0 : on ? 0.45 : 0.3,
      ease: on ? "back.out(1.6)" : "power2.in",
      overwrite: "auto",
    });
  }, [active]);

  // A row that scrolls away under a still pointer gets no pointerleave: hide on scroll.
  useEffect(() => {
    if (!active) return;
    const off = () => setActive(null);
    window.addEventListener("scroll", off, { passive: true, once: true });
    return () => window.removeEventListener("scroll", off);
  }, [active]);

  const tabs = [{ slug: "all", label: copy.filterAll }, ...groups];
  const countOf = (slug: string) => (slug === "all" ? items.length : items.filter((i) => i.group === slug).length);

  return (
    <div className="w-browse">
      <div className="p-bar w-bar" data-p-fade-scroll>
        <div className="p-filters-scroll">
          <span className="p-filter-box" ref={box} aria-hidden="true" />
          <ul className="p-filters" ref={filters} aria-label={copy.filterLabel}>
            {tabs.map((t) => (
              <li key={t.slug}>
                <button type="button" className="p-filter p-mono" aria-pressed={filter === t.slug} onClick={() => pick(t.slug)}>
                  {t.label}
                  <sup className="w-filter-n">{countOf(t.slug)}</sup>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="w-list" ref={list} onPointerMove={onMove} onPointerLeave={() => setActive(null)} data-active={active ? "" : undefined}>
        {items.map((item, i) => (
          <li
            key={item.slug}
            className="w-row"
            data-w-row
            data-on={active === item.slug ? "" : undefined}
            hidden={filter !== "all" && filter !== item.group}
            onPointerEnter={(e) => show(item.slug, e)}
          >
            <Link href={item.href} className="w-row-link" onFocus={() => setActive(null)}>
              <span className="w-num p-mono">{num(i)}</span>
              <span className="w-thumb" aria-hidden="true">
                <Image src={item.image} alt="" fill sizes="4rem" className="w-thumb-img" />
              </span>
              <span className="w-name">
                <span className="w-title">{item.title}</span>
                <span className="w-place">{item.place}</span>
              </span>
              <span className="w-group p-mono">{item.groupLabel}</span>
              <span className="w-year p-mono">{item.year ?? ""}</span>
              <span className="w-go" aria-hidden="true">
                <PArrow className="p-arrow w-go-arrow" />
              </span>
              <span className="p-sr">{copy.open}</span>
            </Link>
            {item.author ? (
              <a href={item.author.url} target="_blank" rel="noopener noreferrer" className="w-credit p-mono">
                {copy.madeBy} <span className="w-credit-name">{item.author.name}</span>
                <span className="p-sr">{copy.portfolioTab}</span>
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="w-preview" ref={preview} aria-hidden="true">
        {armed
          ? items.map((item) => (
              <span key={item.slug} className="w-preview-img" data-on={active === item.slug ? "" : undefined}>
                <Image src={item.image} alt="" fill sizes="22rem" loading="eager" />
              </span>
            ))
          : null}
      </div>
    </div>
  );
}
