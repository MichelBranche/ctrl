import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { localize, type Locale } from "@/lib/i18n";
import type { ShopProduct } from "@/lib/shop";
import "./shop.css";

const copy = {
  it: {
    kicker: "SHOP",
    title: "Shop.",
    lead: ["Get your CTRL essentials.", "Tools, merch and more."],
    categories: "Categorie",
    all: "Tutti i prodotti",
    tech: "Tech & Tools",
    merch: "Merch",
    accessories: "Accessori",
    gift: "Gift Card",
    shown: "Visualizzati 1–1 di 1 prodotto",
    sort: "Ordina per:",
    default: "Predefinito",
    product: "Card recensioni Google",
    priceNote: "NFC + QR",
    madeToOrder: "Realizzata su ordinazione",
    ask: "Richiedi informazioni sulla card",
    imageAlt: "Espositori CTRL per recensioni Google con NFC e QR code",
    viewProduct: "Apri il prodotto",
    
  },
  en: {
    kicker: "SHOP",
    title: "Shop.",
    lead: ["Get your CTRL essentials.", "Tools, merch and more."],
    categories: "Categories",
    all: "All Products",
    tech: "Tech & Tools",
    merch: "Merch",
    accessories: "Accessories",
    gift: "Gift Card",
    shown: "Showing 1–1 of 1 product",
    sort: "Sort by:",
    default: "Default",
    product: "Google Review Card",
    priceNote: "NFC + QR",
    madeToOrder: "Made to order",
    ask: "Ask about this card",
    imageAlt: "CTRL review card displays with NFC and QR code",
    viewProduct: "View product",
    
  },
} as const;

function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6M10 20h.01M18 20h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ShopPage({ lang, product }: { lang: Locale; product: ShopProduct }) {
  const t = copy[lang];
  const title = lang === "it" ? product.titleIt : product.titleEn;
  const price = new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }).format(Number(product.price));

  return (
    <>
      <SiteHeader />
      <main className="shop-page">
        <section className="shop-hero">
          <Image src="/images/shop/hero.webp" alt="" fill priority quality={92} sizes="100vw" className="shop-hero-image" />
          <div className="shop-hero-shade" aria-hidden="true" />
          <div className="shop-hero-content">
            <p className="shop-kicker"><span>{t.kicker}</span><i aria-hidden="true" /></p>
            <h1>{t.title}</h1>
            <p className="shop-hero-lead">{t.lead[0]}<br />{t.lead[1]}</p>
          </div>
        </section>

        <section className="shop-catalog" id="products">
          <Image src="/images/shop/products-bg.webp" alt="" fill quality={88} sizes="100vw" className="shop-catalog-bg" />
          <div className="shop-catalog-shade" aria-hidden="true" />
          <div className="shop-catalog-inner">
            <aside className="shop-categories">
              <p className="shop-side-label">{t.categories}</p>
              <ul>
                <li className="is-current"><span>{t.all}</span><sup>{product.published ? 1 : 0}</sup></li>
                <li><span>{t.tech}</span><sup>{product.published ? 1 : 0}</sup></li>
                <li className="is-empty"><span>{t.merch}</span></li>
                <li className="is-empty"><span>{t.accessories}</span></li>
                <li className="is-empty"><span>{t.gift}</span></li>
              </ul>
            </aside>

            <div className="shop-main">
              <div className="shop-toolbar">
                <span>{product.published ? t.shown : (lang === "it" ? "Nessun prodotto disponibile" : "No products available")}</span>
                <div><span>{t.sort}</span><span className="shop-sort">{t.default}<i aria-hidden="true">⌄</i></span></div>
              </div>
              {product.published ? (
                <>
                  <div className="shop-grid">
                    <article className="shop-product-card">
                      <Link className="shop-product-link" href={localize("/shop/google-review-card", lang)} aria-label={`${t.viewProduct}: ${title}`}>
                      <div className="shop-card-image">
                        <Image
                          src="/images/shop/review-card.webp"
                          alt={t.imageAlt}
                          fill
                          quality={92}
                          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 38vw, 30vw"
                        />
                        <span className="shop-card-index">01</span>
                        <span className="shop-card-cart"><CartIcon /></span>
                      </div>
                      <div className="shop-card-meta">
                        <div><h2>{title}</h2><p>{t.priceNote}</p></div>
                        <span className="shop-card-price">{price}</span>
                      </div>
                      </Link>
                    </article>
                  </div>
                  <nav className="shop-pagination" aria-label={lang === "it" ? "Pagine prodotti" : "Product pages"}>
                    <span aria-current="page">1</span>
                  </nav>
                </>
              ) : (
                <div className="shop-empty">
                  <p>{lang === "it" ? "Stiamo preparando il prossimo drop." : "We’re preparing the next drop."}</p>
                </div>
              )}
              <div className="shop-order-note"><span />{t.madeToOrder}</div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
