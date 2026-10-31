"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { PArrow } from "@/components/projects/arrow";
import { scheduleRefresh } from "@/lib/refresh";

gsap.registerPlugin(Flip);

export type SiteCard = {
  slug: string;
  group: string;
  groupLabel: string;
  title: string;
  place: string;
  description: string;
  tech: string[];
  year?: string;
  url: string;
  image: string;
};

export type SitesCopy = {
  filterLabel: string;
  filterAll: string;
  visit: string;
  newTab: string;
  madeBy: string;
  portfolioTab: string;
  portfolio: string;
};

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Cursor-aware tilt plus a light that follows the pointer. Transform-only, off for touch and reduced motion. */
function onTilt(e: PointerEvent<HTMLElement>) {
  if (!finePointer() || reduced()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  gsap.to(el, { rotateY: (x - 0.5) * 7, rotateX: (0.5 - y) * 7, duration: 0.6, ease: "power3.out", overwrite: "auto" });
}
function offTilt(e: PointerEvent<HTMLElement>) {
  gsap.to(e.currentTarget, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", overwrite: "auto" });
}

export function WebsitesBrowser({ items, groups, copy }: { items: SiteCard[]; groups: { slug: string; label: string }[]; copy: SitesCopy }) {
  const [filter, setFilter] = useState("all");
  const filters = useRef<HTMLUListElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  const moveBox = useCallback((instant = false) => {
    const el = filters.current?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!el || !box.current) return;
    gsap.to(box.current, {
      x: el.offsetLeft,
      width: el.offsetWidth,
      autoAlpha: 1,
      duration: instant || reduced() ? 0 : 0.55,
      ease: "power3.inOut",
      overwrite: true,
    });
  }, []);

  useEffect(() => {
    moveBox(true);
    const onResize = () => moveBox(true);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => moveBox(true));
    return () => window.removeEventListener("resize", onResize);
  }, [moveBox]);

  useLayoutEffect(() => {
    moveBox();
    const state = flipState.current;
    flipState.current = null;
    if (!state || !grid.current) return;
    // Cards still waiting for their scroll-in (hidden at load) must not stay invisible after a filter change.
    gsap.set(grid.current.querySelectorAll("[data-p-card]"), { autoAlpha: 1, y: 0, overwrite: true });
    Flip.from(state, {
      duration: 0.7,
      ease: "power3.inOut",
      absolute: true,
      stagger: 0.03,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.55, delay: 0.2, stagger: 0.05 }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, y: 12, duration: 0.3 }),
      onComplete: scheduleRefresh,
    });
  }, [filter, moveBox]);

  const pick = (value: string) => {
    if (value === filter) return;
    if (grid.current && !reduced()) flipState.current = Flip.getState(grid.current.querySelectorAll("[data-p-item]"));
    else if (grid.current) gsap.set(grid.current.querySelectorAll("[data-p-card]"), { autoAlpha: 1, y: 0, overwrite: true });
    setFilter(value);
  };

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

      <ul className="w-grid" ref={grid}>
        {items.map((item) => (
          <li key={item.slug} className="w-item" data-p-item data-flip-id={item.slug} hidden={filter !== "all" && filter !== item.group}>
            <article className="w-card" data-p-card>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-link" onPointerMove={onTilt} onPointerLeave={offTilt}>
                <span className="w-media" aria-hidden="true">
                  <Image className="w-img" src={item.image} alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 30rem" />
                  <span className="w-shine" />
                </span>
                <span className="w-body">
                  <span className="w-meta p-mono">
                    <span>{item.groupLabel}</span>
                    {item.year ? <span>{item.year}</span> : null}
                  </span>
                  <span className="w-title">{item.title}</span>
                  <span className="w-place">{item.place}</span>
                  <span className="w-text">{item.description}</span>
                  <span className="w-tech">
                    {item.tech.map((t) => (
                      <span key={t} className="w-chip p-mono">{t}</span>
                    ))}
                  </span>
                  <span className="w-go p-mono">
                    {copy.visit}
                    <PArrow className="p-arrow p-card-arrow" />
                    <span className="p-sr">{copy.newTab}</span>
                  </span>
                </span>
              </a>
              <a href={copy.portfolio} target="_blank" rel="noopener noreferrer" className="w-credit p-mono">
                <span className="w-credit-label">{copy.madeBy}</span>
                <PArrow className="p-arrow w-credit-arrow" />
                <span className="p-sr">{copy.portfolioTab}</span>
              </a>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
