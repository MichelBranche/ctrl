"use client";

// Based on Skiper UI skiper6 ("Hover members", https://skiper-ui.com/v1/skiper6).
// Same structure, springs, sizes, easing and centre-out letter stagger as the
// original; adapted to CTRL fonts (Satoshi/Geist), accent and project data.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useSpring } from "motion/react";

export type HoverProject = { key: string; label: string; category?: string; index: string; href: string; image: string | null };

const SPRING = { mass: 0.1, damping: 16, stiffness: 71 };
const EASE = [0.19, 1, 0.22, 1] as const;
const enter = { hidden: { y: "100%" }, visible: { y: "0%" }, exit: { y: "-100%" } };
const base = { hidden: { y: "-100%" }, visible: { y: "0%" }, exit: { y: "0%" } };
const delay = (i: number, len: number) => 0.055 * Math.abs(i - Math.floor(len / 2));

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
          transition={{ duration: 0.8, ease: EASE, delay: delay(i, chars.length) }}
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" />
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
        {items.map((item, i) => <Thumb key={item.key} item={item} i={i} onHover={setActive} onPick={setPicked} current={picked === i} />)}
        <motion.div className="hp-cursor" aria-hidden="true" style={{ x, y, scale, transformOrigin: "left top" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.52182 2.75026L12.8858 9.11422L15.253 0.38299L6.52182 2.75026Z" fill="currentColor" />
            <path d="M0.333095 12.3331L3.30294 15.3029L10.3402 6.56864L9.0674 5.29585L0.333095 12.3331Z" fill="currentColor" />
          </svg>
        </motion.div>
      </div>
      <div className="hp-mask" aria-live="polite">
            <AnimatePresence initial={false}>
              {activeLabel === null && (
                <motion.div key="default" className="hp-layer" initial="hidden" animate="visible" exit="hidden"
                  transition={{ duration: 0.8, ease: EASE }}>
                  <Word text={defaultName} variants={base} className="hp-word-base" />
                </motion.div>
              )}
            </AnimatePresence>
            {/* One layer per distinct label: tiles that share a name (all the
                placeholders do) keep the word on screen instead of replaying it. */}
            {labels.map((label) => (
              <AnimatePresence key={label}>
                {activeLabel === label && (
                  <motion.div className="hp-layer" initial="hidden" animate="visible" exit="hidden"
                    transition={{ duration: 0.8, ease: EASE }}>
                    {(() => {
                      const img = items.find((it) => it.label === label)?.image;
                      return img ? (
                        // The photo sits under a black knockout: white letters (multiply) let it show through the word.
                        <motion.span className="hp-photo" aria-hidden="true" style={{ backgroundImage: `url(${img})` }}
                          initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.9, ease: EASE }} />
                      ) : null;
                    })()}
                    <div className="hp-knock">
                      <Word text={label} variants={enter} className="hp-word-hover" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
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
