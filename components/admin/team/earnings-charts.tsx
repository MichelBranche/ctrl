"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/* Introiti charts: same hand-rolled SVG + Motion approach as the other admin charts. Real data only, explicit empty states. */

const EASE = [0.2, 0.8, 0.2, 1] as const;
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, notation: "compact" });
const fmtMonth = (m: string, long = false) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString("it-IT", long ? { month: "long", year: "numeric" } : { month: "short" });

/** Monthly totals, last 12 months, as animated bars with a hover readout. */
export function MonthlyBars({ data, height = 240 }: { data: { month: string; cents: number }[]; height?: number }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.cents), 0);
  if (!max) return <p className="adm-muted adm-empty">Nessun lavoro registrato negli ultimi 12 mesi.</p>;
  const W = 720, H = height, PAD = { l: 52, r: 8, t: 12, b: 26 };
  const nice = Math.ceil(max / 100 / 4) * 4 * 100 || 100;
  const bw = (W - PAD.l - PAD.r) / data.length;
  const y = (c: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - c / nice);
  const cur = hover !== null ? data[hover] : null;
  return (
    <div className="adm-earn-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Introiti per mese, ultimi 12 mesi">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="adm-area-grid" x1={PAD.l} x2={W - PAD.r} y1={y(nice * f)} y2={y(nice * f)} />
            <text className="adm-area-tick" x={PAD.l - 8} y={y(nice * f) + 4} textAnchor="end">{eur0.format((nice * f) / 100)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = H - PAD.b - y(d.cents);
          const x = PAD.l + i * bw + bw * 0.18;
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} fill="transparent" />
              <motion.rect
                className="adm-earn-bar"
                data-on={hover === i || undefined}
                x={x}
                width={bw * 0.64}
                rx={3}
                initial={reduce ? false : { y: H - PAD.b, height: 0 }}
                animate={{ y: H - PAD.b - h, height: h }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: EASE }}
              />
              <text className="adm-area-tick" x={PAD.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">{fmtMonth(d.month)}</text>
            </g>
          );
        })}
      </svg>
      <p className="adm-earn-readout" aria-live="polite">
        {cur ? (
          <>
            <strong>{fmtMonth(cur.month, true)}</strong> <span>{eur.format(cur.cents / 100)}</span>
          </>
        ) : (
          <span className="adm-muted">Passa sopra un mese per il dettaglio</span>
        )}
      </p>
    </div>
  );
}

/** Totals per person. Only ever receives totals, never job rows. */
export function Leaderboard({ rows, me }: { rows: { userId: string; name: string; area: string | null; totalCents: number; jobs: number }[]; me: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(...rows.map((r) => r.totalCents), 1);
  if (!rows.some((r) => r.totalCents > 0)) return <p className="adm-muted adm-empty">Nessun introito nel periodo.</p>;
  return (
    <ol className="adm-barlist adm-leader">
      {rows.map((r, i) => (
        <li key={r.userId} data-me={r.userId === me || undefined}>
          <motion.span className="adm-barlist-fill" style={{ originX: 0 }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: r.totalCents / max }} transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }} />
          <span className="adm-barlist-key adm-leader-key">
            <b>{i + 1}</b> {r.name}
            {r.area ? <em> · {r.area}</em> : null}
            {r.userId === me ? <em> · tu</em> : null}
          </span>
          <span className="adm-barlist-num">
            {eur.format(r.totalCents / 100)} <em className="adm-muted">· {r.jobs}</em>
          </span>
        </li>
      ))}
    </ol>
  );
}
