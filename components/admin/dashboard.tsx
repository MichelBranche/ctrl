import Link from "next/link";
import { AreaChart, BarList, CountUp, Donut, Sparkline } from "@/components/admin/charts";
import { breakdowns, dailyCounts, delta, latestDeploy, recentActivity, sum, traffic, RANGES, type Range } from "@/lib/dashboard-data";
import { vercelConfigured } from "@/lib/vercel";

/* Server sections shared by Panoramica and Statistiche. Each section fetches its own data inside its own Suspense
 * boundary (see the pages), so a slow Vercel API call never blocks the Turso-backed cards. */

const pct = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

export function RangeTabs({ base, range }: { base: string; range: Range }) {
  return (
    <nav className="adm-seg" aria-label="Periodo">
      {RANGES.map((r) => (
        <Link key={r} href={`${base}?range=${r}`} className="adm-seg-item" aria-current={range === r ? "page" : undefined} scroll={false}>
          {r}g
        </Link>
      ))}
    </nav>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const d = delta(now, before);
  if (d === null) return <span className="adm-delta" title="Nessun dato nel periodo precedente">{now > 0 ? "nuovo" : "–"}</span>;
  return (
    <span className={`adm-delta ${d > 0 ? "is-up" : d < 0 ? "is-down" : ""}`} title="Rispetto al periodo precedente">
      {d > 0 ? "↑" : d < 0 ? "↓" : ""} {pct.format(d)}
    </span>
  );
}

function Card({ label, value, now, before, spark, href, note, i }: { label: string; value: number; now?: number; before?: number; spark?: number[]; href: string; note?: string; i: number }) {
  return (
    <Link href={href} className="adm-stat adm-rise" style={{ "--i": i } as React.CSSProperties}>
      <span className="adm-stat-head">
        <span className="adm-muted">{label}</span>
        {now !== undefined && before !== undefined ? <Delta now={now} before={before} /> : null}
      </span>
      <CountUp value={value} className="adm-stat-num" />
      {spark ? <Sparkline data={spark} label={`Andamento ${label}`} /> : null}
      {note ? <span className="adm-muted">{note}</span> : null}
    </Link>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <div className="adm-stat adm-stat-off">
      <span className="adm-muted">{what}</span>
      <Link href="/admin/settings" className="adm-link">
        {vercelConfigured() ? "Dati non disponibili" : "Configura le statistiche"}
      </Link>
    </div>
  );
}

export async function StatCards({ range, content }: { range: Range; content?: { pub: number; draft: number; reqNew: number; subs: number } | null }) {
  const [t, c] = await Promise.all([traffic(range).catch(() => null), dailyCounts(range)]);
  const pvNow = t ? sum(t.current.map((p) => p.pageviews)) : 0;
  const pvPrev = t ? sum(t.previous.map((p) => p.pageviews)) : 0;
  const viNow = t ? sum(t.current.map((p) => p.visitors)) : 0;
  const viPrev = t ? sum(t.previous.map((p) => p.visitors)) : 0;
  const rq = c ? sum(c.requests) : 0;
  const sb = c ? sum(c.subscribers) : 0;
  let i = 0;
  return (
    <section className="adm-stats" aria-label="Riepilogo">
      {t ? (
        <>
          <Card i={i++} label={`Visualizzazioni, ${range}g`} value={pvNow} now={pvNow} before={pvPrev} spark={t.current.map((p) => p.pageviews)} href={`/admin/stats?range=${range}`} />
          <Card i={i++} label={`Visitatori, ${range}g`} value={viNow} now={viNow} before={viPrev} spark={t.current.map((p) => p.visitors)} href={`/admin/stats?range=${range}`} note="Somma dei visitatori giornalieri" />
        </>
      ) : (
        <Unavailable what="Visite" />
      )}
      {c ? (
        <>
          <Card i={i++} label={`Richieste, ${range}g`} value={rq} now={rq} before={c.prevRequests} spark={c.requests} href="/admin/requests" note={content ? `${content.reqNew} da leggere` : undefined} />
          <Card i={i++} label={`Nuovi iscritti, ${range}g`} value={sb} now={sb} before={c.prevSubscribers} spark={c.subscribers} href="/admin/newsletter" note={content ? `${content.subs} iscritti attivi` : undefined} />
        </>
      ) : (
        <p className="adm-error" role="alert">Database non raggiungibile: i conteggi non sono disponibili.</p>
      )}
      {content ? <Card i={i++} label="Articoli pubblicati" value={content.pub} href="/admin/journal" note={`${content.draft} bozze`} /> : null}
    </section>
  );
}

export async function TrafficPanel({ range, height }: { range: Range; height?: number }) {
  const t = await traffic(range).catch(() => null);
  return (
    <section className="adm-panel adm-rise" aria-labelledby="traffic-h">
      <div className="adm-panel-head">
        <h2 id="traffic-h" className="adm-h2">Traffico</h2>
        <span className="adm-legend-inline">
          <span><i className="adm-key" /> Visualizzazioni</span>
          <span><i className="adm-key is-alt" /> Visitatori</span>
        </span>
      </div>
      {!t ? (
        <p className="adm-muted adm-empty">{vercelConfigured() ? "L'API di Vercel non ha risposto." : "Statistiche non configurate."}</p>
      ) : t.current.every((p) => p.pageviews === 0) ? (
        <p className="adm-muted adm-empty">Nessuna visita registrata negli ultimi {range} giorni.</p>
      ) : (
        <AreaChart data={t.current} height={height} />
      )}
    </section>
  );
}

const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");
const countryName = (cc: string) => {
  try {
    return `${flag(cc)} ${new Intl.DisplayNames(["it"], { type: "region" }).of(cc) ?? cc}`;
  } catch {
    return cc;
  }
};

export async function BreakdownPanels({ range, limit = 6 }: { range: Range; limit?: number }) {
  const b = await breakdowns(range, limit).catch(() => null);
  if (!b) return null;
  return (
    <div className="adm-grid2">
      <section className="adm-panel adm-rise" style={{ "--i": 0 } as React.CSSProperties}>
        <h2 className="adm-h2">Pagine più viste</h2>
        <BarList rows={b.pages} empty="Nessuna pagina vista nel periodo." />
      </section>
      <section className="adm-panel adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="adm-h2">Provenienza</h2>
        <BarList rows={b.refs} empty="Solo accessi diretti nel periodo." />
      </section>
      <section className="adm-panel adm-rise" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="adm-h2">Paesi</h2>
        <BarList rows={b.countries.map((r) => ({ ...r, label: countryName(r.key) }))} empty="Nessun dato sui paesi." />
      </section>
      <section className="adm-panel adm-rise" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="adm-h2">Dispositivi</h2>
        <Donut rows={b.devices} />
      </section>
    </div>
  );
}

const rel = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
function ago(isoTs: string) {
  const s = (Date.parse(isoTs) - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"]];
  let v = s;
  for (const [n, u] of steps) {
    if (Math.abs(v) < n) return rel.format(Math.round(v), u);
    v /= n;
  }
  return rel.format(Math.round(v), "year");
}

const KIND = { post: "Journal", request: "Richiesta", subscriber: "Newsletter" } as const;

export async function ActivityFeed() {
  const items = await recentActivity(8);
  return (
    <section className="adm-panel adm-rise" aria-labelledby="act-h">
      <h2 id="act-h" className="adm-h2">Attività recente</h2>
      {items === null ? (
        <p className="adm-error">Database non raggiungibile.</p>
      ) : items.length === 0 ? (
        <p className="adm-muted adm-empty">Ancora nessuna attività.</p>
      ) : (
        <ol className="adm-feed">
          {items.map((a, i) => (
            <li key={`${a.kind}-${a.href}-${a.at}`} className="adm-rise" style={{ "--i": i } as React.CSSProperties}>
              <span className={`adm-feed-dot is-${a.kind}`} aria-hidden="true" />
              <div>
                <Link href={a.href} className="adm-feed-title">{a.title}</Link>
                <span className="adm-muted">
                  {KIND[a.kind]} · {a.detail}
                </span>
              </div>
              <time dateTime={a.at} className="adm-muted" title={new Date(a.at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}>
                {ago(a.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const STATE: Record<string, [string, string]> = {
  READY: ["Online", "is-ok"],
  BUILDING: ["In build", "is-busy"],
  QUEUED: ["In coda", "is-busy"],
  INITIALIZING: ["In avvio", "is-busy"],
  ERROR: ["Errore", "is-bad"],
  CANCELED: ["Annullato", ""],
};

export async function DeployPill() {
  if (!vercelConfigured()) return null;
  const d = await latestDeploy();
  if (!d) return null;
  const [label, cls] = STATE[d.state] ?? [d.state.toLowerCase(), ""];
  return (
    <Link href="/admin/settings" className={`adm-pill ${cls}`} title={d.message || d.sha}>
      <span className="adm-pill-dot" aria-hidden="true" />
      Produzione: {label}
      <span className="adm-muted">· {ago(new Date(d.createdAt).toISOString())}</span>
    </Link>
  );
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <section className="adm-stats" aria-busy="true" aria-label="Caricamento">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="adm-stat adm-skel" style={{ height: "8.5rem" }} />
      ))}
    </section>
  );
}

export function PanelSkeleton({ h = "18rem" }: { h?: string }) {
  return <div className="adm-panel adm-skel" style={{ height: h }} aria-busy="true" />;
}
