import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ShopCardCartButton } from "@/components/shop/shop-card-cart-button";
import { localize, type Locale } from "@/lib/i18n";
import type { ShopProduct } from "@/lib/shop";
import "./shop.css";

const copy = {
  it: { kicker: "SHOP", title: "Shop.", lead: ["Get your CTRL essentials.", "Tools, merch and more."], categories: "Categorie", all: "Tutti i prodotti", tech: "Tech & Tools", merch: "Merch", accessories: "Accessori", gift: "Gift Card", sort: "Ordina per:", default: "Predefinito", madeToOrder: "Realizzata su ordinazione", viewProduct: "Apri il prodotto", none: "Stiamo preparando il prossimo drop." },
  en: { kicker: "SHOP", title: "Shop.", lead: ["Get your CTRL essentials.", "Tools, merch and more."], categories: "Categories", all: "All Products", tech: "Tech & Tools", merch: "Merch", accessories: "Accessories", gift: "Gift Card", sort: "Sort by:", default: "Default", madeToOrder: "Made to order", viewProduct: "View product", none: "We’re preparing the next drop." },
} as const;

export function ShopPage({ lang, products }: { lang: Locale; products: ShopProduct[] }) {
  const t = copy[lang];
  const visible = products.filter((product) => product.published);
  const money = new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" });

  return <>
    <SiteHeader />
    <main className="shop-page">
      <section className="shop-hero">
        <Image src="/images/shop/hero.webp" alt="" fill priority quality={90} sizes="100vw" className="shop-hero-image" />
        <div className="shop-hero-shade" aria-hidden="true" />
        <div className="shop-hero-content"><p className="shop-kicker"><span>{t.kicker}</span><i aria-hidden="true" /></p><h1>{t.title}</h1><p className="shop-hero-lead">{t.lead[0]}<br />{t.lead[1]}</p></div>
      </section>
      <section className="shop-catalog" id="products">
        <Image src="/images/shop/products-bg.webp" alt="" fill quality={90} sizes="100vw" className="shop-catalog-bg" />
        <div className="shop-catalog-shade" aria-hidden="true" />
        <div className="shop-catalog-inner">
          <aside className="shop-categories"><p className="shop-side-label">{t.categories}</p><ul>
            <li className="is-current"><span>{t.all}</span><sup>{visible.length}</sup></li>
            <li><span>{t.tech}</span><sup>{visible.length}</sup></li>
            <li className="is-empty"><span>{t.merch}</span><sup>0</sup></li>
            <li className="is-empty"><span>{t.accessories}</span><sup>0</sup></li>
            <li className="is-empty"><span>{t.gift}</span><sup>0</sup></li>
          </ul></aside>
          <div className="shop-main">
            <div className="shop-toolbar"><span>{lang === "it" ? `Visualizzati 1–${visible.length} di ${visible.length} prodotti` : `Showing 1–${visible.length} of ${visible.length} products`}</span><div><span>{t.sort}</span><span className="shop-sort">{t.default}<i aria-hidden="true">⌄</i></span></div></div>
            {visible.length ? <div className="shop-grid">{visible.map((product, index) => {
              const title = lang === "it" ? product.titleIt : product.titleEn;
              const image = product.images[0] || "/images/shop/review-card-hero.webp";
              return <article className="shop-product-card" key={product.id}>
                <div className="shop-card-visual">
                  <Link className="shop-card-image" data-shop-transition="forward" href={localize(`/shop/${product.slug}`, lang)} aria-label={`${t.viewProduct}: ${title}`}>
                    <Image src={image} alt={title} fill quality={90} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 38vw, 30vw" />
                    <span className="shop-card-index">{String(index + 1).padStart(2, "0")}</span>
                  </Link>
                  <ShopCardCartButton product={product} lang={lang} />
                </div>
                <Link className="shop-product-link" data-shop-transition="forward" href={localize(`/shop/${product.slug}`, lang)} aria-label={`${t.viewProduct}: ${title}`}>
                  <div className="shop-card-meta"><div><h2>{title}</h2><p>{product.images.length > 1 ? `${product.images.length} ${lang === "it" ? "immagini" : "images"}` : (lang === "it" ? "CTRL®" : "CTRL®")}</p></div><span className="shop-card-price">{money.format(Number(product.price))}</span></div>
                </Link>
              </article>;
            })}</div> : <div className="shop-empty"><p>{t.none}</p></div>}
            <div className="shop-order-note"><span />{t.madeToOrder}</div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
