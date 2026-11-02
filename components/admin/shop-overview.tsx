import Link from "next/link";
import { Sparkline } from "@/components/admin/charts";
import { ago } from "@/components/admin/dashboard";
import { Count } from "@/components/admin/shop/shop-charts";
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
import type { Range } from "@/lib/dashboard-data";
import { db, dbConfigured } from "@/lib/db";
import { ORDER_STATUS_LABEL } from "@/lib/shop-data";
import { buildReport, getAdminOrders, type AdminOrder } from "@/lib/shop-orders";

/* Shop block for Panoramica: real orders only (same aggregation as the Shop tab), its own Suspense boundary on the page. */

const pct = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const DAY = 86_400_000;
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  if (!before) return <span className="adm-delta" title="Nessun dato nel periodo precedente">{now > 0 ? "nuovo" : "–"}</span>;
  const d = (now - before) / before;
  return <span className={`adm-delta ${d > 0 ? "is-up" : d < 0 ? "is-down" : ""}`} title="Rispetto al periodo precedente">{d > 0 ? "↑" : d < 0 ? "↓" : ""} {pct.format(d)}</span>;
}

async function publishedProducts(): Promise<{ published: number; total: number } | null> {
  if (!dbConfigured) return null;
  try {
    const r = await db().execute("SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE published = 1) AS p FROM shop_products");
    return { published: Number(r.rows[0]?.p ?? 0), total: Number(r.rows[0]?.n ?? 0) };
  } catch {
    return null;
  }
}

/** Order requests (any status) created in the range, the previous range, and per day for the sparkline. */
function requestStats(orders: AdminOrder[], range: Range, now = Date.now()) {
  const since = day(now - (range - 1) * DAY);
  const prevSince = day(now - (range * 2 - 1) * DAY);
  const inRange = orders.filter((o) => o.createdAt.slice(0, 10) >= since);
  const prevRequests = orders.filter((o) => { const d = o.createdAt.slice(0, 10); return d >= prevSince && d < since; }).length;
  const perDay = new Map<string, number>();
  for (const o of inRange) perDay.set(o.createdAt.slice(0, 10), (perDay.get(o.createdAt.slice(0, 10)) ?? 0) + 1);
  const spark = Array.from({ length: range }, (_, i) => perDay.get(day(now - (range - 1 - i) * DAY)) ?? 0);
  return { inRange, prevRequests, spark };
}

export async function ShopOverview({ range }: { range: Range }) {
  // getAdminOrders() runs the (idempotent) shop schema check first, so the products count reads an existing table.
  const orders = dbConfigured ? await getAdminOrders().catch(() => null) : [];
  const products = await publishedProducts();
  const head = (
    <div className="adm-panel-head">
      <h2 className="adm-h2">Shop</h2>
      <Link href="/admin/shop" className="adm-link">Apri lo shop admin →</Link>
    </div>
  );
  if (orders === null) return <section className="adm-ov-shop" aria-label="Shop">{head}<p className="adm-error" role="alert">Impossibile leggere gli ordini dello shop.</p></section>;

  const r = buildReport(orders, String(range) as "7" | "30" | "90");
  const { inRange, prevRequests, spark } = requestStats(orders, range);
  const recent = orders.slice(0, 5);

  const cards = [
    { k: `Richieste d’ordine, ${range}g`, v: inRange.length, money: false, d: <Delta now={inRange.length} before={prevRequests} />, spark, note: r.pending ? `${r.pending} da evadere` : "Tutto evaso", href: "/admin/shop?tab=ordini", hot: r.pending > 0 },
    { k: `Fatturato stimato, ${range}g`, v: r.revenue, money: true, d: <Delta now={r.revenue} before={r.prev?.revenue} />, note: `${r.orders} ordini confermati`, href: `/admin/shop${range === 30 ? "" : `?period=${range}`}` },
    { k: `Margine stimato, ${range}g`, v: r.margin, money: true, d: null, note: r.marginKnown ? "Fatturato − costo fornitore" : "Alcuni costi fornitore mancanti: stima per eccesso", href: `/admin/shop${range === 30 ? "" : `?period=${range}`}` },
    { k: "Prodotti pubblicati", v: products?.published ?? 0, money: false, d: null, note: products ? `${products.total} in catalogo` : "Catalogo non disponibile", href: "/admin/shop?tab=prodotti" },
  ];

  return (
    <section className="adm-ov-shop" aria-label="Shop">
      {head}
      <div className="adm-ov-shop-grid">
        <div className="adm-stats adm-ov-shop-stats">
          {cards.map((c, i) => (
            <Link key={c.k} href={c.href} className={`adm-stat adm-rise${c.hot ? " adm-ov-hot" : ""}`} data-hot={c.hot || undefined} style={{ "--i": i } as React.CSSProperties}>
              <span className="adm-stat-head"><span className="adm-muted">{c.k}</span>{c.d}{c.hot ? <span className="adm-ov-ping" aria-hidden="true" /> : null}</span>
              <Count value={c.v} money={c.money} className="adm-stat-num" />
              {c.spark ? <Sparkline data={c.spark} label="Andamento richieste d’ordine" /> : null}
              <span className="adm-muted">{c.note}</span>
            </Link>
          ))}
        </div>
        <section className="adm-panel adm-rise" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="ov-orders-h">
          <div className="adm-panel-head">
            <h3 id="ov-orders-h" className="adm-h2">Ultimi ordini</h3>
            {orders.length ? <Link href="/admin/shop?tab=ordini" className="adm-link">Tutti</Link> : null}
          </div>
          {recent.length === 0 ? (
            <p className="adm-muted adm-empty">Ancora nessun ordine. Le richieste dallo shop compariranno qui.</p>
          ) : (
            <ol className="adm-feed">
              {recent.map((o, i) => (
                <li key={o.id} className="adm-rise" style={{ "--i": i } as React.CSSProperties}>
                  <span className={`adm-feed-dot is-order is-${o.status}`} aria-hidden="true" />
                  <div>
                    <Link href="/admin/shop?tab=ordini" className="adm-feed-title">#{o.number} · {o.name}</Link>
                    <span className="adm-muted">{ORDER_STATUS_LABEL[o.status]} · {eur.format(o.total)}</span>
                  </div>
                  <time dateTime={o.createdAt} className="adm-muted" title={new Date(o.createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}>{ago(o.createdAt)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}
