"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { JArrow } from "@/components/journal/arrow";
import { PostCard } from "@/components/journal/post-card";
import type { JournalCopy } from "@/components/journal/journal-copy";
import type { Locale } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_LABEL, type Category, type Post } from "@/lib/journal-types";

const PER_PAGE = 6;
type Filter = Category | "all";

function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function JournalBrowser({ posts, lang, copy }: { posts: Post[]; lang: Locale; copy: JournalCopy }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const bar = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Read ?cat= & ?page= once on mount (no useSearchParams: keeps the shell static).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const cat = qs.get("cat") as Category | null;
    const p = Number(qs.get("page"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    if (cat && CATEGORIES.includes(cat)) setFilter(cat);
    if (p > 1) setPage(p);
  }, []);

  const filtered = useMemo(() => (filter === "all" ? posts : posts.filter((p) => p.category === filter)), [posts, filter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const sync = useCallback((f: Filter, p: number) => {
    const url = new URL(window.location.href);
    if (f === "all") url.searchParams.delete("cat");
    else url.searchParams.set("cat", f);
    if (p > 1) url.searchParams.set("page", String(p));
    else url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const choose = (f: Filter) => {
    setFilter(f);
    setPage(1);
    sync(f, 1);
  };
  const go = (p: number) => {
    setPage(p);
    sync(filter, p);
    grid.current?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Sliding underline under the active filter.
  const place = useCallback(() => {
    const el = bar.current?.querySelector<HTMLElement>("[aria-pressed='true']");
    const ln = line.current;
    if (!el || !ln || !bar.current) return;
    const box = bar.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    ln.style.transform = `translateX(${r.left - box.left + bar.current.scrollLeft}px) scaleX(${r.width / 100})`;
  }, []);
  useLayoutEffect(() => {
    place();
  }, [filter, place]);
  useEffect(() => {
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // Re-stagger cards when the filter or page changes (initial reveal is in JournalMotion).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!grid.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      grid.current.querySelectorAll("[data-j-card]"),
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.06, overwrite: true },
    );
  }, [filter, current]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: copy.all },
    ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[lang][c] })),
  ];

  return (
    <section className="j-list" aria-label={copy.metaTitle}>
      <div className="j-filters-wrap" data-j-fade-scroll>
        <div className="j-filters" ref={bar} role="group" aria-label={copy.filterLabel}>
          {filters.map((f, i) => (
            <span className="j-filter-item" key={f.key}>
              {i > 0 ? <span className="j-dot" aria-hidden="true" /> : null}
              <button type="button" className="j-filter" aria-pressed={filter === f.key} onClick={() => choose(f.key)}>
                {f.label}
              </button>
            </span>
          ))}
          <span className="j-filter-line" ref={line} aria-hidden="true" />
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="j-empty" data-j-fade-scroll>
          <span className="j-empty-mark" aria-hidden="true">
            <span />
          </span>
          <h2 className="j-empty-title">{copy.emptyTitle}</h2>
          <p className="j-empty-text">{copy.emptyText}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="j-empty j-empty-sm">
          <p className="j-empty-text">{copy.emptyCat}</p>
          <button type="button" className="j-text-btn" onClick={() => choose("all")}>
            {copy.showAll}
            <JArrow />
          </button>
        </div>
      ) : (
        <div className="j-grid" ref={grid}>
          {visible.map((post) => (
            <PostCard key={post.id} post={post} lang={lang} read={copy.read} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="j-pager" aria-label={copy.pagination}>
          <button type="button" className="j-circle" onClick={() => go(current - 1)} disabled={current === 1} aria-label={copy.prev}>
            <JArrow className="j-arrow j-arrow-back" />
          </button>
          <ol className="j-pages">
            {pageList(current, totalPages).map((n, i) =>
              n === "gap" ? (
                <li key={`gap-${i}`} className="j-gap" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={n}>
                  <button
                    type="button"
                    className="j-page"
                    aria-current={n === current ? "page" : undefined}
                    aria-label={`${copy.page} ${n}`}
                    onClick={() => go(n)}
                  >
                    {n}
                  </button>
                </li>
              ),
            )}
          </ol>
          <button type="button" className="j-circle" onClick={() => go(current + 1)} disabled={current === totalPages} aria-label={copy.next}>
            <JArrow />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
