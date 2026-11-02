"use client";

import Image from "next/image";
import { useOptimistic, useTransition } from "react";
import { setProductPublished } from "@/app/admin/shop-actions";
import { eur } from "./shop-charts";

export type ProductCardData = { id: string; title: string; slug: string; image: string; price: number; supplierCost: number | null; published: boolean; sold: number; revenue: number };

export function ProductCards({ products }: { products: ProductCardData[] }) {
  if (!products.length) return null;
  return <div className="shop-adm-cards">{products.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}</div>;
}

function ProductCard({ p, i }: { p: ProductCardData; i: number }) {
  const [on, setOn] = useOptimistic(p.published);
  const [pending, start] = useTransition();
  const flip = () => start(async () => {
    setOn(!on);
    const res = await setProductPublished(p.id, !on).catch(() => ({ ok: false }));
    if (!res.ok) alert(`Aggiornamento non riuscito per ${p.title}.`);
  });
  const margin = p.supplierCost === null ? null : p.price - p.supplierCost;
  const pct = margin !== null && p.price > 0 ? Math.round((margin / p.price) * 100) : null;
  return <article className="shop-adm-card adm-rise" style={{ "--i": i } as React.CSSProperties} data-off={!on || undefined}>
    <div className="shop-adm-card-img">{p.image ? <Image src={p.image} alt="" fill sizes="96px" /> : null}</div>
    <div className="shop-adm-card-body">
      <div className="shop-adm-row"><h3 title={p.title}>{p.title}</h3>
        <span className="adm-switch-cell"><button type="button" role="switch" aria-checked={on} aria-label={`${on ? "Nascondi" : "Pubblica"} ${p.title}`} className="adm-switch" data-on={on || undefined} aria-busy={pending} onClick={flip}><span className="adm-switch-knob" /></button></span>
      </div>
      <p className="adm-muted shop-adm-card-state">{on ? "Visibile nello shop" : "Nascosto"}</p>
      <dl className="shop-adm-card-nums">
        <div><dt>Prezzo</dt><dd>{eur.format(p.price)}</dd></div>
        <div><dt>Costo</dt><dd>{p.supplierCost === null ? "—" : eur.format(p.supplierCost)}</dd></div>
        <div><dt>Margine</dt><dd className={margin !== null ? "is-accent" : undefined}>{margin === null ? "—" : `${eur.format(margin)} · ${pct}%`}</dd></div>
        <div><dt>Venduti</dt><dd>{p.sold} pz · {eur.format(p.revenue)}</dd></div>
      </dl>
      {pct !== null ? <span className="shop-adm-meter" aria-hidden="true"><i style={{ "--w": `${Math.max(0, Math.min(100, pct))}%` } as React.CSSProperties} /></span> : <p className="adm-muted shop-adm-hint">Imposta il costo fornitore per vedere il margine.</p>}
      <div className="shop-adm-card-actions"><a className="adm-link" href={`#p-${p.id}`}>Modifica</a><a className="adm-link" href={`/shop/${p.slug}`} target="_blank" rel="noopener noreferrer">Vedi ↗</a></div>
    </div>
  </article>;
}
