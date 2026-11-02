"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/shop-data";

/* Shop report charts: same hand-rolled SVG + Motion approach as components/admin/charts.tsx. Real data only, explicit empty states. */

const EASE = [0.2, 0.8, 0.2, 1] as const;
export const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat("it-IT");
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

/** Count-up for money or plain numbers. The server HTML already holds the final value. */
export function Count({ value, money = false, className }: { value: number; money?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const fmt = (v: number) => (money ? eur.format(v) : nf.format(Math.round(v)));
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const c = animate(0, value, { duration: 1.1, ease: EASE, onUpdate: (v) => (el.textContent = fmt(v)) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, money]);
  return <span ref={ref} className={className}>{fmt(value)}</span>;
}

export function SalesChart({ data, height = 260 }: { data: { date: string; revenue: number; orders: number }[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!data.length || data.every((d) => d.revenue === 0 && d.orders === 0)) {
    return <div className="shop-adm-empty"><p>Nessuna vendita confermata nel periodo.</p><span className="adm-muted">Le richieste diventano vendite quando le segni come “Confermata”.</span></div>;
  }
  const PAD = { t: 16, r: 8, b: 26, l: 48 };
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const p = 10 ** Math.floor(Math.log10(max));
  const nice = Math.ceil(max / p) * p;
  const maxO = Math.max(1, ...data.map((d) => d.orders));
  const step = iw / Math.max(1, data.length);
  const x = (i: number) => PAD.l + step * i + step / 2;
  const y = (v: number) => PAD.t + ih - (v / nice) * ih;
  const base = PAD.t + ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.revenue)}`).join(" ");
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 72)));
  const show = inView || reduce;
  const h = hover !== null ? data[hover] : null;
  const pick = (cx: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.max(0, Math.min(data.length - 1, Math.floor((cx - r.left - PAD.l) / step))));
  };
  return (
    <div ref={wrap} className="adm-area" style={{ height }} onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)} tabIndex={0} role="group"
      aria-label="Fatturato e ordini per giorno. Usa le frecce per leggere i singoli giorni."
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
        else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? data.length) - 1));
        else if (e.key === "Escape") setHover(null);
      }} onBlur={() => setHover(null)}>
      {w > 0 ? <svg width={w} height={height} aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--adm-accent)" stopOpacity="0.3" /><stop offset="1" stopColor="var(--adm-accent)" stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map((f) => <g key={f}><line className="adm-area-grid" x1={PAD.l} x2={w - PAD.r} y1={y(nice * f)} y2={y(nice * f)} /><text className="adm-area-tick" x={PAD.l - 8} y={y(nice * f) + 4} textAnchor="end">{eur0.format(nice * f)}</text></g>)}
        {data.map((d, i) => d.orders ? <motion.rect key={d.date} className="shop-adm-bar" x={x(i) - Math.min(10, step * 0.3)} width={Math.min(20, step * 0.6)} rx={2}
          initial={reduce ? false : { y: base, height: 0 }} animate={show ? { y: base - (d.orders / maxO) * ih * 0.35, height: (d.orders / maxO) * ih * 0.35 } : undefined}
          transition={{ duration: 0.7, delay: 0.2 + i * 0.015, ease: EASE }} data-active={hover === i || undefined} /> : null)}
        <motion.path d={`${line} L${x(data.length - 1)},${base} L${x(0)},${base} Z`} fill={`url(#${gid})`} initial={reduce ? false : { opacity: 0 }} animate={show ? { opacity: 1 } : undefined} transition={{ duration: 0.8, delay: 0.4 }} />
        <motion.path d={line} fill="none" stroke="var(--adm-accent)" strokeWidth={2} strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={show ? { pathLength: 1 } : undefined} transition={{ duration: 1.1, ease: EASE }} />
        {data.map((d, i) => i % every === 0 ? <text key={d.date} className="adm-area-tick" x={x(i)} y={height - 6} textAnchor="middle">{fmtDay(d.date)}</text> : null)}
        {h && hover !== null ? <g><line className="adm-area-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={base} /><circle className="adm-area-dot" cx={x(hover)} cy={y(h.revenue)} r={4.5} /></g> : null}
      </svg> : null}
      {h && hover !== null ? <div className="adm-tip" style={{ left: Math.min(Math.max(x(hover), 80), w - 80), top: 8 }} role="status">
        <strong>{fmtDay(h.date)}</strong><span>{eur.format(h.revenue)} fatturato</span><span className="adm-muted">{h.orders} {h.orders === 1 ? "ordine" : "ordini"}</span>
      </div> : null}
    </div>
  );
}

export function ProductBars({ rows }: { rows: { key: string; label: string; value: number; quantity: number }[] }) {
  const reduce = useReducedMotion();
  if (!rows.length) return <p className="adm-muted adm-empty">Nessun prodotto venduto nel periodo.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <ol className="adm-barlist">
    {rows.map((r, i) => <li key={r.key}>
      <motion.span className="adm-barlist-fill" style={{ originX: 0 }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: r.value / max }} transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }} />
      <span className="adm-barlist-key shop-adm-barkey" title={r.label}>{r.label} <em>× {r.quantity}</em></span>
      <span className="adm-barlist-num">{eur.format(r.value)}</span>
    </li>)}
  </ol>;
}

export const STATUS_COLOR: Record<OrderStatus, string> = {
  richiesta: "#f1c94b", confermata: "var(--adm-accent)", ordinata: "#8ab4ff", spedita: "#c39bff", consegnata: "var(--adm-ok)", annullata: "rgba(242,240,234,0.3)",
};

export function StatusDonut({ rows }: { rows: { key: OrderStatus; value: number }[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="adm-muted adm-empty">Nessun ordine nel periodo.</p>;
  const R = 52;
  const C = 2 * Math.PI * R;
  const offs = rows.map((_, i) => rows.slice(0, i).reduce((a, r) => a + r.value / total, 0));
  const cur = active !== null ? rows[active] : null;
  return <div className="adm-donut">
    <svg viewBox="0 0 140 140" role="img" aria-label={rows.map((r) => `${ORDER_STATUS_LABEL[r.key]} ${r.value}`).join(", ")}>
      <circle cx="70" cy="70" r={R} className="adm-donut-track" />
      {rows.map((r, i) => {
        const frac = r.value / total;
        return <motion.circle key={r.key} cx="70" cy="70" r={R} fill="none" stroke={STATUS_COLOR[r.key]} strokeWidth={active === i ? 16 : 12}
          strokeDasharray={`${Math.max(0, frac * C - (rows.length > 1 ? 2 : 0))} ${C}`} transform={`rotate(${offs[i] * 360 - 90} 70 70)`}
          initial={reduce ? false : { strokeDashoffset: frac * C }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: EASE }}
          onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} style={{ transition: "stroke-width 0.15s ease" }} />;
      })}
      <text x="70" y="66" textAnchor="middle" className="adm-donut-num">{cur ? cur.value : total}</text>
      <text x="70" y="84" textAnchor="middle" className="adm-donut-label">{cur ? ORDER_STATUS_LABEL[cur.key].split(" ")[0].toLowerCase() : "ordini"}</text>
    </svg>
    <ul className="adm-legend">
      {rows.map((r, i) => <li key={r.key} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} data-active={active === i || undefined}>
        <i style={{ background: STATUS_COLOR[r.key] }} /><span>{ORDER_STATUS_LABEL[r.key]}</span><span className="adm-barlist-num">{r.value}</span>
      </li>)}
    </ul>
  </div>;
}
