"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

/* Hand-rolled SVG charts animated with Motion (already a site dependency, so no new bundle weight).
 * Every chart takes real series from the server and renders an explicit empty state instead of zeros dressed up as data. */

const EASE = [0.2, 0.8, 0.2, 1] as const;
const nf = new Intl.NumberFormat("it-IT");
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const fmtDay = (d: string, long = false) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

/** Smooth monotone-ish path through points (Catmull-Rom to Bezier, clamped so it never overshoots below zero). */
function smooth(pts: [number, number][], floor: number) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function CountUp({ value, className, money = false }: { value: number; className?: string; money?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const paint = (n: number) => (money ? eur.format(n) : nf.format(Math.round(n)));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = (n: number) => (money ? eur.format(n) : nf.format(Math.round(n)));
    if (reduce) {
      el.textContent = draw(value);
      return;
    }
    const c = animate(0, value, { duration: 1.1, ease: EASE, onUpdate: (v) => (el.textContent = draw(v)) });
    return () => c.stop();
  }, [value, reduce, money]);
  // Server HTML already holds the final number, so no-JS and screen readers see the real value.
  return (
    <span ref={ref} className={className}>
      {paint(value)}
    </span>
  );
}

export function Sparkline({ data, label }: { data: number[]; label: string }) {
  const gid = useId();
  const W = 128;
  const H = 40;
  const series = data.length > 1 ? data : [0, 0, 0, 0];
  const flat = series.every((v) => v === 0);
  const values = flat ? series.map((_, i) => 0.18 + Math.sin(i * 0.85) * 0.025) : series;
  const max = flat ? 1 : Math.max(...values, 0.01);
  const pts = values.map((v, i): [number, number] => [(i / (values.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
  const line = smooth(pts, H - 2);
  const tone = flat ? "rgba(242,240,234,0.55)" : "var(--adm-accent)";
  return (
    <svg className={`adm-spark${flat ? " is-flat" : ""}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={flat ? "#f2f0ea" : "var(--adm-accent)"} stopOpacity={flat ? 0.16 : 0.55} />
          <stop offset="1" stopColor={flat ? "#f2f0ea" : "var(--adm-accent)"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
      <path className="adm-spark-line" d={line} fill="none" stroke={tone} strokeWidth="2" pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type SeriesPoint = { date: string; pageviews: number; visitors: number };

export function AreaChart({ data, height = 260 }: { data: SeriesPoint[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(960);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => setW(Math.max(280, Math.round(el.clientWidth)));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD = { t: 16, r: 8, b: 26, l: 36 };
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const max = Math.max(1, ...data.map((d) => d.pageviews));
  const nice = useMemo(() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / p) * p;
  }, [max]);
  const x = (i: number) => PAD.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / nice) * ih;
  const base = PAD.t + ih;
  const pv = smooth(data.map((d, i) => [x(i), y(d.pageviews)]), base);
  const vi = smooth(data.map((d, i) => [x(i), y(d.visitors)]), base);
  const ticks = [0, 0.5, 1].map((f) => Math.round(nice * f));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 72)));

  const pick = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || data.length === 0) return;
    const i = Math.round(((clientX - r.left - PAD.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div
      ref={wrap}
      className="adm-area"
      style={{ height }}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
      tabIndex={0}
      role="group"
      aria-label="Grafico visite per giorno. Usa le frecce per leggere i singoli giorni."
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
        else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? data.length) - 1));
        else if (e.key === "Escape") setHover(null);
      }}
      onBlur={() => setHover(null)}
    >
      {w > 0 ? <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-pv`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--adm-accent)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--adm-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="adm-area-grid" />
            <text x={PAD.l - 8} y={y(t)} className="adm-area-tick" textAnchor="end" dominantBaseline="middle">
              {nf.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={height - 6} className="adm-area-tick" textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>
              {fmtDay(d.date)}
            </text>
          ) : null,
        )}
        <g>
          <path className="adm-area-fill" d={`${pv} L${x(data.length - 1)},${base} L${x(0)},${base} Z`} fill={`url(#${gid}-pv)`} />
          <path className="adm-area-line" d={pv} fill="none" stroke="var(--adm-accent)" strokeWidth="2.25" pathLength={1} />
          <path d={vi} fill="none" stroke="var(--adm-fg)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 4" />
        </g>
        {h && hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={base} className="adm-area-cross" />
            <circle cx={x(hover)} cy={y(h.pageviews)} r="4.5" className="adm-area-dot" />
            <circle cx={x(hover)} cy={y(h.visitors)} r="3.5" className="adm-area-dot is-alt" />
          </g>
        ) : null}
      </svg> : null}
      {h && hover !== null ? (
        <div className="adm-tip" role="status" style={{ left: Math.min(Math.max(x(hover), 90), w - 90), top: PAD.t }}>
          <strong>{fmtDay(h.date, true)}</strong>
          <span>
            <i className="adm-key" /> {nf.format(h.pageviews)} visualizzazioni
          </span>
          <span>
            <i className="adm-key is-alt" /> {nf.format(h.visitors)} visitatori
          </span>
        </div>
      ) : null}
    </div>
  );
}

export type Row = { key: string; pageviews: number; visitors: number };

export function BarList({ rows, empty }: { rows: (Row & { label?: string })[]; empty: string }) {
  if (!rows.length) return <p className="adm-muted adm-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.pageviews), 1);
  return (
    <ol className="adm-barlist">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="adm-barlist-fill" style={{ transform: `scaleX(${r.pageviews / max})`, animationDelay: `${i * 50}ms` }} />
          <span className="adm-barlist-key" title={r.key}>
            {r.label ?? r.key}
          </span>
          <span className="adm-barlist-num">{nf.format(r.pageviews)}</span>
        </li>
      ))}
    </ol>
  );
}

const DEVICE: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
const SHADES = ["var(--adm-accent)", "var(--adm-fg)", "rgba(242,240,234,0.45)", "rgba(242,240,234,0.25)"];

export function Donut({ rows, empty = "Nessun dato sui dispositivi.", centerLabel = "visualizzazioni", showShare = false }: { rows: (Row & { label?: string })[]; empty?: string; centerLabel?: string; showShare?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((a, r) => a + r.pageviews, 0);
  if (!total) return <p className="adm-muted adm-empty">{empty}</p>;
  const R = 52;
  const C = 2 * Math.PI * R;
  const offs = rows.map((_, i) => rows.slice(0, i).reduce((a, r) => a + r.pageviews / total, 0));
  const cur = active !== null ? rows[active] : null;
  return (
    <div className="adm-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={rows.map((r) => `${r.label ?? DEVICE[r.key] ?? r.key} ${Math.round((r.pageviews / total) * 100)}%`).join(", ")}>
        <circle cx="70" cy="70" r={R} className="adm-donut-track" />
        {rows.map((r, i) => {
          const frac = r.pageviews / total;
          const off = offs[i];
          return (
            <circle
              key={r.key}
              className="adm-donut-seg"
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={SHADES[i % SHADES.length]}
              strokeWidth={active === i ? 16 : 14}
              strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`}
              strokeDashoffset={0}
              transform={`rotate(${off * 360 - 90} 70 70)`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              style={{ animationDelay: `${0.12 + i * 0.1}s`, cursor: "default" }}
            />
          );
        })}
        <text x="70" y="66" textAnchor="middle" className="adm-donut-num">
          {cur ? `${Math.round((cur.pageviews / total) * 100)}%` : nf.format(total)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="adm-donut-label">
          {cur ? (cur.label ?? DEVICE[cur.key] ?? cur.key) : centerLabel}
        </text>
      </svg>
      <ul className="adm-legend">
        {rows.map((r, i) => (
          <li key={r.key} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} data-active={active === i || undefined}>
            <i style={{ background: SHADES[i % SHADES.length] }} />
            <span>{r.label ?? DEVICE[r.key] ?? r.key}</span>
            {showShare ? <span className="adm-barlist-num">{nf.format(r.pageviews)}</span> : null}
            <span className="adm-barlist-num">{Math.round((r.pageviews / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
