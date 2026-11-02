"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ShopCardCartButton } from "@/components/shop/shop-card-cart-button";
import { localize, type Locale } from "@/lib/i18n";
import { SHOP_CATEGORIES, SHOP_CATEGORY_LABEL, type ShopCategory, type ShopProduct } from "@/lib/shop-data";

type Sort = "default" | "price-asc" | "price-desc" | "name" | "newest";
const copy = {
  it: { categories: "Categorie", all: "Tutti i prodotti", sort: "Ordina per:", viewProduct: "Apri il prodotto", none: "Nessun prodotto in questa categoria.", showing: (n: number, t: number) => `Visualizzati ${n ? `1–${n}` : "0"} di ${t} prodotti`, images: "immagini",
    sorts: { default: "Predefinito", "price-asc": "Prezzo crescente", "price-desc": "Prezzo decrescente", name: "Nome", newest: "Novità" } },
  en: { categories: "Categories", all: "All Products", sort: "Sort by:", viewProduct: "View product", none: "No products in this category.", showing: (n: number, t: number) => `Showing ${n ? `1–${n}` : "0"} of ${t} products`, images: "images",
    sorts: { default: "Default", "price-asc": "Price: low to high", "price-desc": "Price: high to low", name: "Name", newest: "Newest" } },
} as const;

export function ShopCatalog({ lang, products }: { lang: Locale; products: ShopProduct[] }) {
  const t = copy[lang];
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [sort, setSort] = useState<Sort>("default");
  const money = useMemo(() => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }), [lang]);
  const titleOf = (p: ShopProduct) => (lang === "it" ? p.titleIt : p.titleEn);
  const counts = useMemo(() => Object.fromEntries(SHOP_CATEGORIES.map((c) => [c, products.filter((p) => p.category === c).length])) as Record<ShopCategory, number>, [products]);
  const visible = useMemo(() => {
    const list = products.filter((p) => category === "all" || p.category === category);
    const by: Record<Sort, (a: ShopProduct, b: ShopProduct) => number> = {
      default: (a, b) => a.sortOrder - b.sortOrder,
      "price-asc": (a, b) => Number(a.price) - Number(b.price),
      "price-desc": (a, b) => Number(b.price) - Number(a.price),
      name: (a, b) => titleOf(a).localeCompare(titleOf(b), lang),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return [...list].sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- titleOf only depends on lang
  }, [products, category, sort, lang]);

  return <>
    <aside className="shop-categories"><p className="shop-side-label">{t.categories}</p><ul>
      <li className={category === "all" ? "is-current" : undefined}><button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}><span>{t.all}</span><sup>{products.length}</sup></button></li>
      {SHOP_CATEGORIES.map((c) => <li key={c} className={[category === c ? "is-current" : "", counts[c] ? "" : "is-empty"].join(" ").trim() || undefined}>
        <button type="button" aria-pressed={category === c} disabled={!counts[c]} onClick={() => setCategory(c)}><span>{SHOP_CATEGORY_LABEL[lang][c]}</span><sup>{counts[c]}</sup></button>
      </li>)}
    </ul></aside>
    <div className="shop-main">
      <div className="shop-toolbar"><span aria-live="polite">{t.showing(visible.length, products.length)}</span><label><span>{t.sort}</span>
        <span className="shop-sort"><select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{(Object.keys(t.sorts) as Sort[]).map((s) => <option key={s} value={s}>{t.sorts[s]}</option>)}</select><i aria-hidden="true">⌄</i></span>
      </label></div>
      {visible.length ? <div className="shop-grid">{visible.map((product, index) => {
        const title = titleOf(product);
        const image = product.images[0] || "/images/shop/review-card-hero.webp";
        const href = localize(`/shop/${product.slug}`, lang);
        return <article className="shop-product-card" key={product.id}>
          <div className="shop-card-visual">
            <Link className="shop-card-image" data-shop-transition="forward" href={href} aria-label={`${t.viewProduct}: ${title}`}>
              <Image src={image} alt={title} fill quality={90} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 38vw, 30vw" />
              <span className="shop-card-index">{String(index + 1).padStart(2, "0")}</span>
            </Link>
            <ShopCardCartButton product={product} lang={lang} />
          </div>
          <Link className="shop-product-link" data-shop-transition="forward" href={href} aria-label={`${t.viewProduct}: ${title}`}>
            <div className="shop-card-meta"><div><h2>{title}</h2><p>{product.images.length > 1 ? `${product.images.length} ${t.images}` : SHOP_CATEGORY_LABEL[lang][product.category]}</p></div><span className="shop-card-price">{money.format(Number(product.price))}</span></div>
          </Link>
        </article>;
      })}</div> : <div className="shop-empty"><p>{t.none}</p></div>}
    </div>
  </>;
}
