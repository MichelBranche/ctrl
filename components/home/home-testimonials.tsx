"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/use-locale";
import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";
import "./home-testimonials.css";

/**
 * Paged bento of client reviews. Structure and motion follow the reference
 * capture (see .reanimate/testimonial/spec.md): 12-column grid, two layouts that
 * alternate per page, cards rising in with an 85ms stagger, the outgoing page
 * lifting away with a 30ms stagger, a 7s progress pill driving autoplay.
 */
type Kind = "quote" | "feature" | "cover";
/** seq: entrance order (the reference brings the big card in first). */
type Slot = { area: string; kind: Kind; tone: string; seq: number };

/** Desktop layouts (reference page A then page B), cycled per page. */
const LAYOUTS: Slot[][] = [
  [
    { area: "1 / 1 / 2 / 8", kind: "quote", tone: "accent", seq: 0 },
    { area: "1 / 8 / 2 / 13", kind: "feature", tone: "paper", seq: 1 },
    { area: "2 / 1 / 3 / 5", kind: "quote", tone: "grey", seq: 2 },
    { area: "2 / 5 / 3 / 9", kind: "cover", tone: "ink", seq: 3 },
    { area: "2 / 9 / 3 / 13", kind: "quote", tone: "char", seq: 4 },
  ],
  [
    { area: "1 / 5 / 2 / 9", kind: "feature", tone: "paper", seq: 1 },
    { area: "1 / 1 / 3 / 5", kind: "cover", tone: "ink", seq: 0 },
    { area: "1 / 9 / 2 / 13", kind: "quote", tone: "accent", seq: 2 },
    { area: "2 / 5 / 3 / 9", kind: "quote", tone: "grey", seq: 3 },
    { area: "2 / 9 / 3 / 13", kind: "quote", tone: "char", seq: 4 },
  ],
];
const MOBILE_TONES = ["accent", "paper", "grey", "char"];
const PER_PAGE = { desktop: 5, mobile: 2 };
/** Reference timings (ms). */
const IN_STAGGER = 85;
const OUT_STAGGER = 30;
const OUT_MS = 460;

const COPY = {
  it: { kicker: "Recensioni", title: "Chi ha lavorato con noi", em: "lo racconta", based: (n: number) => `Basato su ${n} recensioni`, prev: "Recensioni precedenti", next: "Recensioni successive", page: (n: number) => `Pagina ${n}`, stars: (n: number) => `${n} stelle su 5` },
  en: { kicker: "Reviews", title: "The people we work with", em: "say it best", based: (n: number) => `Based on ${n} reviews`, prev: "Previous reviews", next: "Next reviews", page: (n: number) => `Page ${n}`, stars: (n: number) => `${n} out of 5 stars` },
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="tm-stars" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 12 12" aria-hidden="true" data-on={i < value ? "" : undefined}>
          <path d="M6 .9 7.5 4.1l3.5.4-2.6 2.4.7 3.5L6 8.7 2.9 10.4l.7-3.5L1 4.5l3.5-.4z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}

/** Quote with its marked phrase wrapped for the highlight sweep. */
function Quote({ text, mark }: { text: string; mark: string }) {
  const at = mark ? text.indexOf(mark) : -1;
  const body =
    at < 0 ? text : (
      <>
        {text.slice(0, at)}
        <span className="tm-mark">{mark}</span>
        {text.slice(at + mark.length)}
      </>
    );
  return <>“{body}”</>;
}

function Avatar({ item, size = 34 }: { item: Testimonial; size?: number }) {
  return item.avatar ? (
    <Image className="tm-avatar" src={item.avatar} alt="" width={size} height={size} sizes={`${size}px`} quality={80} />
  ) : (
    <span className="tm-avatar" aria-hidden="true">
      {initials(item.name)}
    </span>
  );
}

function sizeOf(text: string) {
  return text.length > 380 ? "l" : text.length > 200 ? "m" : "s";
}

function Card({ item, slot, lang, index, stars }: { item: Testimonial; slot: Slot; lang: "it" | "en"; index: number; stars: string }) {
  const quote = item.quote[lang];
  const short = `${item.name.split(" ")[0]} ${item.name.split(" ").slice(-1)[0][0]}.`;
  const avatar = <Avatar item={item} />;
  const person = (
    <div className="tm-person">
      {avatar}
      <div className="tm-person-text">
        <span className="tm-name">{item.name}</span>
        <Stars value={item.stars} label={stars} />
      </div>
    </div>
  );
  return (
    <figure className="tm-bed" data-kind={slot.kind} data-tone={slot.tone} data-size={sizeOf(quote)} style={{ gridArea: slot.area, "--i": index } as React.CSSProperties}>
      <div className="tm-face">
        {slot.kind === "cover" && item.cover ? (
          <div className="tm-cover">
            <Image
              className="tm-zoom"
              src={item.cover.src}
              alt={item.cover.alt[lang]}
              fill
              sizes="(max-width: 809px) 100vw, 33vw"
              quality={72}
            />
          </div>
        ) : null}
        <div className="tm-body">
          {slot.kind === "quote" ? (
            <>
              <div className="tm-txt tm-t1">{person}</div>
              <blockquote className="tm-txt tm-t2 tm-quote">
                <p>
                  <Quote text={quote} mark={item.mark[lang]} />
                </p>
              </blockquote>
              <figcaption className="tm-txt tm-t2 tm-meta">
                <span>{short}</span> <span>·</span> <span>{item.role[lang]}</span>
              </figcaption>
            </>
          ) : null}
          {slot.kind === "feature" ? (
            <>
              <div className="tm-feature-top">
                <span className="tm-glyph" aria-hidden="true">
                  “
                </span>
                <span className="tm-txt tm-t1 tm-tag">{item.role[lang]}</span>
              </div>
              <blockquote className="tm-txt tm-t2 tm-quote">
                <p>
                  <Quote text={quote} mark={item.mark[lang]} />
                </p>
              </blockquote>
              <figcaption className="tm-txt tm-t3 tm-foot">{person}</figcaption>
            </>
          ) : null}
          {slot.kind === "cover" ? (
            <>
              <span className="tm-txt tm-t0 tm-tag tm-tag-top">{item.role[lang]}</span>
              <div className="tm-cover-text">
                <div className="tm-txt tm-t1">
                  <Stars value={item.stars} label={stars} />
                  <blockquote className="tm-quote">
                    <p>
                      <Quote text={quote} mark={item.mark[lang]} />
                    </p>
                  </blockquote>
                </div>
                <figcaption className="tm-txt tm-t2 tm-foot">
                  <span className="tm-name">{item.name}</span>
                  <span className="tm-role">{item.role[lang]}</span>
                </figcaption>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </figure>
  );
}

export function HomeTestimonials() {
  const { lang } = useLocale();
  const c = COPY[lang];
  const root = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  const [seen, setSeen] = useState(false);
  const [page, setPage] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);

  const per = mobile ? PER_PAGE.mobile : PER_PAGE.desktop;
  const pages = Array.from({ length: Math.ceil(TESTIMONIALS.length / per) }, (_, p) => TESTIMONIALS.slice(p * per, p * per + per));
  const count = pages.length;
  const avg = TESTIMONIALS.reduce((sum, t) => sum + t.stars, 0) / TESTIMONIALS.length;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 809.98px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setMobile(mq.matches);
      setReduce(rm.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    setPage(0);
    setLeaving(null);
  }, [mobile]);

  // Reveal once in view; autoplay only while visible.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const leaveTimer = useRef<number | undefined>(undefined);
  const go = useCallback(
    (next: number) => {
      const target = ((next % count) + count) % count;
      if (target === page) return;
      window.clearTimeout(leaveTimer.current);
      setLeaving(page);
      setPage(target);
      leaveTimer.current = window.setTimeout(() => setLeaving(null), OUT_MS + OUT_STAGGER * PER_PAGE.desktop);
    },
    [count, page],
  );
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const running = seen && visible && !paused && !reduce;

  return (
    <section
      ref={root}
      className="hv-block tm"
      id="reviews"
      aria-labelledby="tm-title"
      aria-roledescription="carousel"
      data-seen={seen || reduce ? "" : undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hv-card tm-card">
        <header className="tm-hd">
          <div className="tm-hd-left">
            <p className="tm-kicker">
              <i aria-hidden="true" />
              {c.kicker}
            </p>
            <h2 className="tm-title" id="tm-title">
              {c.title} <em>{c.em}</em>
            </h2>
          </div>
          <div className="tm-score">
            <span className="tm-faces" aria-hidden="true">
              {TESTIMONIALS.filter((t) => t.avatar).slice(0, 4).map((t) => (
                <Avatar key={t.name} item={t} size={30} />
              ))}
            </span>
            <div className="tm-score-text">
              <p className="tm-score-row">
                <strong>{avg.toFixed(1)}</strong>
                <Stars value={Math.round(avg)} label={c.stars(Number(avg.toFixed(1)))} />
              </p>
              <p className="tm-score-based">{c.based(TESTIMONIALS.length)}</p>
            </div>
          </div>
        </header>

        <div className="tm-stage">
          {pages.map((items, p) => {
            const state = p === page ? "in" : p === leaving ? "out" : "off";
            const layout = LAYOUTS[p % LAYOUTS.length];
            return (
              <div
                key={`${mobile ? "m" : "d"}-${p}`}
                className="tm-page"
                data-state={state}
                aria-hidden={state !== "in"}
                inert={state !== "in"}
                aria-roledescription="slide"
                aria-label={c.page(p + 1)}
              >
                {items.map((item, i) => {
                  const n = p * per + i;
                  const slot: Slot = mobile
                    ? { area: "auto", kind: item.cover ? "cover" : n % 3 === 1 ? "feature" : "quote", tone: item.cover ? "ink" : MOBILE_TONES[n % MOBILE_TONES.length], seq: i }
                    : layout[i];
                  return <Card key={item.name} item={item} slot={slot} lang={lang} index={mobile ? i : slot.seq} stars={c.stars(item.stars)} />;
                })}
              </div>
            );
          })}
        </div>

        <div className="tm-controls">
          <p className="tm-count" aria-live={running ? "off" : "polite"}>
            <span>{String(page + 1).padStart(2, "0")}</span> / {String(count).padStart(2, "0")}
          </p>
          <div className="tm-pills">
            {pages.map((_, p) => (
              <button
                key={p}
                type="button"
                className="tm-pill"
                data-active={p === page ? "" : undefined}
                aria-label={c.page(p + 1)}
                aria-current={p === page ? "true" : undefined}
                onClick={() => go(p)}
              >
                {p === page ? (
                  <span
                    key={`${page}-${mobile}`}
                    className="tm-fill"
                    style={{ animationPlayState: running ? "running" : "paused" }}
                    onAnimationEnd={() => go(page + 1)}
                  />
                ) : null}
              </button>
            ))}
          </div>
          <div className="tm-arrows">
            <button type="button" className="tm-arrow" aria-label={c.prev} onClick={() => go(page - 1)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button type="button" className="tm-arrow" aria-label={c.next} onClick={() => go(page + 1)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
