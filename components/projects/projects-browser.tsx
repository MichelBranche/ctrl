"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GridIcon, ListIcon, PArrow } from "@/components/projects/arrow";
import type { ProjectsCopy } from "@/components/projects/projects-copy";

gsap.registerPlugin(Flip, ScrollTrigger);

export type BrowserCopy = Pick<ProjectsCopy, "all" | "filterLabel" | "filterAll" | "viewLabel" | "gridView" | "listView" | "open">;

export type CategoryCard = { slug: string; label: string; title: string[]; text: string; image: string; href: string };
type View = "grid" | "list";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ProjectsBrowser({ items, copy }: { items: CategoryCard[]; copy: BrowserCopy }) {
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<View>("grid");
  const filters = useRef<HTMLUListElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  // Sliding outline under the active filter.
  const moveBox = useCallback((instant = false) => {
    const list = filters.current;
    const el = list?.querySelector<HTMLElement>("[aria-pressed='true']");
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

  // Capture card positions before a layout change, then animate from them.
  const capture = () => {
    if (!grid.current || reduced()) return;
    flipState.current = Flip.getState(grid.current.querySelectorAll("[data-p-item]"));
  };

  useLayoutEffect(() => {
    moveBox();
    const state = flipState.current;
    flipState.current = null;
    if (!state || !grid.current) return;
    Flip.from(state, {
      duration: 0.75,
      ease: "power3.inOut",
      absolute: true,
      nested: true,
      stagger: 0.03,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.5, delay: 0.2 }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.96, duration: 0.35 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  }, [filter, view, moveBox]);

  const pickFilter = (value: string) => {
    if (value === filter) return;
    capture();
    setFilter(value);
  };
  const pickView = (value: View) => {
    if (value === view) return;
    capture();
    setView(value);
  };

  return (
    <section className="p-browse" id="progetti" aria-label={copy.all}>
      <div className="p-bar" data-p-fade-scroll>
        <div className="p-filters-scroll">
          <span className="p-filter-box" ref={box} aria-hidden="true" />
          <ul className="p-filters" ref={filters} aria-label={copy.filterLabel}>
            {[{ slug: "all", label: copy.filterAll }, ...items].map((f) => (
              <li key={f.slug}>
                <button type="button" className="p-filter p-mono" aria-pressed={filter === f.slug} onClick={() => pickFilter(f.slug)}>
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-views" role="group" aria-label={copy.viewLabel}>
          <button type="button" className="p-view p-mono" aria-pressed={view === "grid"} onClick={() => pickView("grid")}>
            <span>{copy.gridView}</span>
            <GridIcon />
          </button>
          <button type="button" className="p-view p-mono" aria-pressed={view === "list"} onClick={() => pickView("list")}>
            <span>{copy.listView}</span>
            <ListIcon />
          </button>
        </div>
      </div>

      <ul className="p-grid" ref={grid} data-view={view}>
        {items.map((item, i) => (
          <li key={item.slug} className="p-item" data-p-item data-flip-id={item.slug} hidden={filter !== "all" && filter !== item.slug}>
            <Link href={item.href} className="p-card" data-p-card>
              <span className="p-media" aria-hidden="true">
                <span className="p-media-in" data-p-parallax>
                  <Image
                    className="p-img"
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 760px) 100vw, (max-width: 1440px) 50vw, 720px"
                    priority={i < 2}
                  />
                </span>
              </span>
              <span className="p-body">
                <span className="p-tag p-mono">{item.label}</span>
                <span className="p-card-title">
                  {item.title.map((line) => (
                    <span key={line}>{line} </span>
                  ))}
                </span>
                <span className="p-card-text">{item.text}</span>
                <span className="p-card-go">
                  <PArrow className="p-arrow p-card-arrow" />
                  <span className="p-sr">{copy.open}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
