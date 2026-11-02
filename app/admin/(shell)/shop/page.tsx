import Link from "next/link";
import { Suspense } from "react";
import { OrdersPanel } from "@/components/admin/shop/orders-panel";
import { ProductCards } from "@/components/admin/shop/product-cards";
import { ShopProductForm } from "@/components/admin/shop/product-form";
import { Count, ProductBars, SalesChart, StatusDonut } from "@/components/admin/shop/shop-charts";
import { requireAdmin } from "@/lib/admin";
import { dbConfigured } from "@/lib/db";
import { getShopProductsAdmin } from "@/lib/shop";
import { buildReport, getAdminOrders, PERIODS, SOLD, type Period } from "@/lib/shop-orders";
import { translationConfigured } from "@/lib/translate";
import "./shop-admin.css";

const TABS = { panoramica: "Panoramica", ordini: "Ordini", prodotti: "Prodotti" } as const;
type Tab = keyof typeof TABS;
const PERIOD_LABEL: Record<Period, string> = { "7": "7 giorni", "30": "30 giorni", "90": "90 giorni", all: "Tutto" };
const pct = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

export default function ShopAdminPage({ searchParams }: PageProps<"/admin/shop">) {
  return <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}><Body searchParams={searchParams} /></Suspense>;
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/shop">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = typeof sp.tab === "string" && sp.tab in TABS ? (sp.tab as Tab) : "panoramica";
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "30";
  const [products, orders] = await Promise.all([getShopProductsAdmin(), getAdminOrders().catch(() => null)]);
  const pending = orders?.filter((o) => o.status === "richiesta").length ?? 0;
  const href = (t: Tab, p: Period = period) => `/admin/shop?tab=${t}${t === "panoramica" && p !== "30" ? `&period=${p}` : ""}`;

  return <main className="adm-main shop-adm">
    <header className="adm-top">
      <div><h1 className="adm-h1">Shop</h1><p className="adm-muted">Vendite, richieste d’ordine, prodotti e margini. I pagamenti online non sono ancora attivi: gli ordini arrivano come richieste.</p></div>
      <div className="adm-top-actions"><a className="adm-btn" href="/shop" target="_blank" rel="noopener noreferrer">Apri lo shop ↗</a></div>
    </header>
    {!dbConfigured ? <p className="adm-note">Database non configurato: in questa anteprima le modifiche non possono essere salvate.</p> : null}
    <nav className="shop-adm-tabs" aria-label="Sezioni shop">
      {(Object.keys(TABS) as Tab[]).map((t) => <Link key={t} href={href(t)} scroll={false} className="shop-adm-tab" aria-current={tab === t ? "page" : undefined}>
        {TABS[t]}{t === "ordini" && pending ? <span className="adm-badge" aria-label={`${pending} richieste da evadere`}>{pending}</span> : null}
      </Link>)}
    </nav>
    {orders === null && tab !== "prodotti" ? <p className="adm-error" role="alert">Impossibile leggere gli ordini.</p> : null}

    {tab === "panoramica" && orders ? <Overview orders={orders} period={period} href={href} /> : null}
    {tab === "ordini" && orders ? <section aria-label="Ordini"><OrdersPanel orders={orders} /></section> : null}
    {tab === "prodotti" ? <Products products={products} orders={orders ?? []} /> : null}
  </main>;
}

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  if (!before) return <span className="adm-delta" title="Nessun dato nel periodo precedente">{now > 0 ? "nuovo" : "–"}</span>;
  const d = (now - before) / before;
  return <span className={`adm-delta ${d > 0 ? "is-up" : d < 0 ? "is-down" : ""}`} title="Rispetto al periodo precedente">{d > 0 ? "↑" : d < 0 ? "↓" : ""} {pct.format(d)}</span>;
}

function Overview({ orders, period, href }: { orders: Awaited<ReturnType<typeof getAdminOrders>>; period: Period; href: (t: Tab, p?: Period) => string }) {
  const r = buildReport(orders, period);
  const label = period === "all" ? "da sempre" : `${period}g`;
  const cards = [
    { k: "Fatturato", v: r.revenue, money: true, d: <Delta now={r.revenue} before={r.prev?.revenue} />, note: "Ordini confermati, non annullati" },
    { k: "Ordini", v: r.orders, money: false, d: <Delta now={r.orders} before={r.prev?.orders} />, note: `Confermati ${label}` },
    { k: "Valore medio", v: r.average, money: true, d: null, note: "Per ordine confermato" },
    { k: "Margine lordo stimato", v: r.margin, money: true, d: null, note: r.marginKnown ? "Fatturato − costo fornitore" : "Alcuni prodotti senza costo fornitore: stima per eccesso" },
  ];
  return <>
    <div className="adm-panel-head shop-adm-periodbar">
      <h2 className="adm-h2">Report vendite</h2>
      <nav className="adm-seg" aria-label="Periodo">{PERIODS.map((p) => <Link key={p} href={href("panoramica", p)} scroll={false} className="adm-seg-item" aria-current={period === p ? "page" : undefined}>{PERIOD_LABEL[p]}</Link>)}</nav>
    </div>
    <section className="adm-stats shop-adm-stats" aria-label="Indicatori">
      {cards.map((c, i) => <div key={c.k} className="adm-stat adm-rise" style={{ "--i": i } as React.CSSProperties}>
        <span className="adm-stat-head"><span className="adm-muted">{c.k}</span>{c.d}</span>
        <Count value={c.v} money={c.money} className="adm-stat-num" />
        <span className="adm-muted shop-adm-note">{c.note}</span>
      </div>)}
      <Link href={href("ordini")} className="adm-stat adm-rise shop-adm-pending" style={{ "--i": 4 } as React.CSSProperties} data-hot={r.pending > 0 || undefined}>
        <span className="adm-stat-head"><span className="adm-muted">Richieste da evadere</span>{r.pending ? <span className="shop-adm-ping" aria-hidden="true" /> : null}</span>
        <Count value={r.pending} className="adm-stat-num" />
        <span className="adm-muted shop-adm-note">{r.pending ? "Apri gli ordini →" : "Tutto evaso"}</span>
      </Link>
    </section>
    <section className="adm-panel adm-rise" style={{ "--i": 5 } as React.CSSProperties}>
      <div className="adm-panel-head"><h2 className="adm-h2">Fatturato e ordini</h2><span className="adm-legend-inline"><span><i className="shop-adm-key is-line" />Fatturato</span><span><i className="shop-adm-key is-bar" />Ordini</span></span></div>
      <SalesChart data={r.series} />
    </section>
    <div className="adm-grid2 shop-adm-grid">
      <section className="adm-panel adm-rise" style={{ "--i": 6 } as React.CSSProperties}><div className="adm-panel-head"><h2 className="adm-h2">Vendite per prodotto</h2></div><ProductBars rows={r.byProduct} /></section>
      <section className="adm-panel adm-rise" style={{ "--i": 7 } as React.CSSProperties}><div className="adm-panel-head"><h2 className="adm-h2">Ordini per stato</h2><span className="adm-muted">{period === "all" ? "Da sempre" : `Ultimi ${period} giorni`}</span></div><StatusDonut rows={r.byStatus} /></section>
    </div>
  </>;
}

async function Products({ products, orders }: { products: Awaited<ReturnType<typeof getShopProductsAdmin>>; orders: Awaited<ReturnType<typeof getAdminOrders>> }) {
  const translationReady = translationConfigured();
  const sold = new Map<string, { q: number; v: number }>();
  for (const o of orders) if (SOLD.includes(o.status)) for (const i of o.items) {
    const s = sold.get(i.slug) ?? { q: 0, v: 0 };
    s.q += i.quantity; s.v += i.lineTotal; sold.set(i.slug, s);
  }
  const cards = products.map((p) => ({
    id: p.id, title: p.titleIt, slug: p.slug, image: p.images[0] ?? "", price: Number(p.price), supplierCost: p.supplierCost === "" ? null : Number(p.supplierCost),
    published: p.published, sold: sold.get(p.slug)?.q ?? 0, revenue: Math.round((sold.get(p.slug)?.v ?? 0) * 100) / 100,
  }));
  return <>
    <h2 className="adm-h2">Catalogo</h2>
    {cards.length ? <ProductCards products={cards} /> : <p className="adm-note">Nessun prodotto. Usa il modulo qui sotto per aggiungerne uno.</p>}
    <details className="adm-panel shop-adm-new"><summary>Aggiungi un prodotto</summary><ShopProductForm key={`new-${products.length}`} translationReady={translationReady} /></details>
    <h2 className="adm-h2">Modifica prodotti</h2>
    {products.map((product) => <div key={`${product.id}-${product.updatedAt}`} id={`p-${product.id}`} className="shop-adm-anchor"><ShopProductForm product={product} translationReady={translationReady} /></div>)}
    <section className="adm-panel"><h2 className="adm-h2">Fornitura e pagamenti</h2><p className="adm-muted">Il costo fornitore resta solo nell’admin e serve a stimare i margini. Le richieste d’ordine sono sempre prezzate dal server; quando verrà attivato il pagamento il totale sarà ricalcolato allo stesso modo (mai dai prezzi inviati dal browser).</p></section>
  </>;
}
