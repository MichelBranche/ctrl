"use client";

// Based on Skiper UI skiper6 ("Hover members", https://skiper-ui.com/v1/skiper6).
// Same structure, springs, sizes, easing and centre-out letter stagger as the
// original; adapted to CTRL fonts (Satoshi/Geist), accent and project data.
import NextImage from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useSpring } from "motion/react";

export type HoverProject = { key: string; label: string; category?: string; index: string; href: string; image: string | null; tint?: string };

const SPRING = { mass: 0.1, damping: 16, stiffness: 71 };
const EASE = [0.19, 1, 0.22, 1] as const;
const enter = { hidden: { y: "100%" }, visible: { y: "0%" }, exit: { y: "-100%" } };
const base = { hidden: { y: "-100%" }, visible: { y: "0%" }, exit: { y: "0%" } };
const delay = (i: number, len: number) => 0.018 * Math.abs(i - Math.floor(len / 2));

// skiper6 uses 28vw Thunder (ultra condensed). Our display face is wider, so
// (skiper6 mounts client-only; we SSR the idle word with initial={false}.)
// long words are scaled down to keep them on one line inside the 22vw mask.
const fit = (word: string) => `min(22vw, ${(150 / Math.max(word.length, 1)).toFixed(2)}vw)`;

function Word({ text, variants, className }: { text: string; variants: typeof enter; className: string }) {
  const chars = Array.from(text);
  return (
    <h3 className={`hp-word ${className}`} style={{ fontSize: fit(text) }}>
      {chars.map((c, i) => (
        <motion.span
          key={i}
          className="hp-char"
          variants={variants}
          transition={{ duration: 0.45, ease: EASE, delay: delay(i, chars.length) }}
        >
          {c === " " ? "\u00a0" : c}
        </motion.span>
      ))}
    </h3>
  );
}

function Thumb({ item, i, onHover, onPick, current }: { item: HoverProject; i: number; onHover: (i: number | null) => void; onPick: (i: number) => void; current: boolean }) {
  const [hover, setOn] = useState(false);
  const touch = useRef(false);
  const on = hover || current;
  return (
    <motion.div
      className="hp-thumb"
      data-on={on ? "" : undefined}
      style={{ width: on ? 120 : 60, height: on ? 120 : 60 }}
      animate={{ width: on ? 120 : 60, height: on ? 120 : 60 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onHoverStart={() => { setOn(true); onHover(i); }}
      onHoverEnd={() => { setOn(false); onHover(null); }}
    >
      <Link href={item.href} className="hp-thumb-in" aria-label={`${item.index} ${item.label}${item.category ? `, ${item.category}` : ""}`}
        onPointerDown={(e) => {
          touch.current = e.pointerType !== "mouse";
          // Tells the page transition (window capture listener) to leave a preview tap alone.
          if (touch.current && !current) e.currentTarget.dataset.preview = "";
          else delete e.currentTarget.dataset.preview;
        }}
        onClick={(e) => {
          // Touch: first tap previews the project in the giant word, second tap opens it.
          if (touch.current && !current) { e.preventDefault(); onPick(i); }
        }}
        onFocus={() => { setOn(true); onHover(i); }} onBlur={() => { setOn(false); onHover(null); }}>
        {item.image ? (
          <NextImage src={item.image} alt="" fill sizes="(max-width: 900px) 55px, 120px" quality={75} />
        ) : (
          <span className="h-placeholder" aria-hidden="true" />
        )}
        <span className="hp-thumb-num">{item.index}</span>
      </Link>
    </motion.div>
  );
}

export function HoverProjects({ items, defaultName, openLabel, hint }: { items: HoverProject[]; defaultName: string; openLabel?: string; hint?: string }) {
  const [active, setActive] = useState<number | null>(null);
  // Touch has no hover: a tapped tile stays selected until another is tapped.
  const [picked, setPicked] = useState<number | null>(null);
  const shown = active ?? picked;
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hover = (i: number | null) => {
    if (leave.current) clearTimeout(leave.current);
    leave.current = null;
    if (i !== null) setActive(i);
    else leave.current = setTimeout(() => setActive(null), 140);
  };
  useEffect(() => () => { if (leave.current) clearTimeout(leave.current); }, []);
  // Desktop warms the originals immediately, same as before. Mobile skips them so they do not compete with LCP.
  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    for (const it of items) if (it.image) { const im = new Image(); im.src = it.image; void im.decode().catch(() => {}); }
  }, [items]);

  const row = useRef<HTMLDivElement>(null);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const scale = useSpring(0, { mass: 0.1, damping: 10, stiffness: 150 });
  const labels = Array.from(new Set(items.map((item) => item.label)));
  const activeLabel = shown === null ? null : items[shown].label;
  const cur = shown === null ? null : items[shown];
  // Last pointer position in viewport coords, so the follower can be re-anchored
  // when the row moves under a still pointer (wheel / Lenis smooth scroll).
  const pointer = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const place = () => {
    const r = row.current?.getBoundingClientRect();
    if (r) { x.set(pointer.current.x - r.left); y.set(pointer.current.y - r.top); }
  };
  useEffect(() => {
    const onScroll = () => {
      if (!pointer.current.inside) return;
      const r = row.current?.getBoundingClientRect();
      const { x: px, y: py } = pointer.current;
      if (r && (px < r.left || px > r.right || py < r.top || py > r.bottom)) {
        // The row scrolled out from under the pointer: no pointerleave fires.
        pointer.current.inside = false;
        scale.set(0);
        setActive(null);
        return;
      }
      place();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one listener; it reads refs and stable springs
  }, []);

  return (
    <div className="hp-root">
      <div
        ref={row}
        className="hp-row"
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          pointer.current = { x: e.clientX, y: e.clientY, inside: true };
          place();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          pointer.current = { x: e.clientX, y: e.clientY, inside: true };
          place();
          scale.set(1);
        }}
        onPointerLeave={() => { pointer.current.inside = false; scale.set(0); }}
      >
        {items.map((item, i) => <Thumb key={item.key} item={item} i={i} onHover={hover} onPick={setPicked} current={picked === i} />)}
        <motion.div className="hp-cursor" aria-hidden="true" style={{ x, y, scale, transformOrigin: "left top" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.52182 2.75026L12.8858 9.11422L15.253 0.38299L6.52182 2.75026Z" fill="currentColor" />
            <path d="M0.333095 12.3331L3.30294 15.3029L10.3402 6.56864L9.0674 5.29585L0.333095 12.3331Z" fill="currentColor" />
          </svg>
        </motion.div>
      </div>
      <div className="hp-mask" aria-live="polite">
            {/* Every layer stays mounted and just switches between "hidden" and "visible", so a quick
                back-and-forth retargets the running animation instead of queueing exits/enters. */}
            <motion.div className="hp-layer" initial={false} animate={activeLabel === null ? "visible" : "hidden"} aria-hidden={activeLabel !== null}>
              <Word text={defaultName} variants={base} className="hp-word-base" />
            </motion.div>
            {/* One layer per distinct label: tiles that share a name keep the word on screen. */}
            {labels.map((label) => {
              const on = activeLabel === label;
              const tint = items.find((it) => it.label === label)?.tint;
              return (
                <motion.div key={label} className="hp-layer" initial={false} animate={on ? "visible" : "hidden"}
                  variants={{ hidden: { opacity: 0, transition: { duration: 0.2 } }, visible: { opacity: 1, transition: { duration: 0.12 } } }}
                  style={{ pointerEvents: "none", zIndex: on ? 2 : 1 }} aria-hidden={!on}>
                  {tint ? (
                    // The brand gradient sits under a black knockout: white letters (multiply) let it show through the word.
                    // Vector gradient, so it stays sharp at any width/DPR.
                    <span className="hp-photo" aria-hidden="true" style={{ background: tint }} />
                  ) : null}
                  <div className="hp-knock">
                    <Word text={label} variants={enter} className="hp-word-hover" />
                  </div>
                </motion.div>
              );
            })}
      </div>
      <div className="hp-caption" aria-live="polite">
        {cur ? (
          <Link href={cur.href} className="hp-open">
            <span className="hp-cap-num">{cur.index}</span>
            <span className="hp-cap-name">{cur.label}</span>
            {cur.category && <span className="hp-cap-cat">{cur.category}</span>}
            <span className="hp-cap-go">{openLabel} <span aria-hidden="true">&rarr;</span></span>
          </Link>
        ) : (
          <span className="hp-cap-hint">{hint}</span>
        )}
      </div>
    </div>
  );
}
