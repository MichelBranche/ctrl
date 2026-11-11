import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";
import { ShopIcon } from "@/components/shop/shop-icons";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductActions } from "@/components/shop/product-actions";
import { ProductManual } from "@/components/shop/product-manual";
import { SHOP_CATEGORY_LABEL, type ShopProduct } from "@/lib/shop-data";
import { localize, type Locale } from "@/lib/i18n";
import "./shop.css";

const copy = {
  it: { backToShop: "Torna allo shop", reviewKicker: "Recensioni", reviewTitle: ["Cosa dicono", "i nostri clienti"], reviewEmpty: "Le recensioni verificate dei clienti saranno pubblicate qui appena disponibili.", madeToOrder: "Realizzata su ordinazione" },
  en: { backToShop: "Back to shop", reviewKicker: "Reviews", reviewTitle: ["What our", "customers say"], reviewEmpty: "Verified customer reviews will appear here when available.", madeToOrder: "Made to order" },
} as const;

function BenefitIcon({ index }: { index: number }) {
  const paths = [
    "M4 19v-5h4v5M10 19V9h4v10M16 19V4h4v15M3 21h18",
    "M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6zM8.5 12l2.2 2.2 4.8-5",
    "M4 5h16v14H4zM9 9l7 3-7 3z",
    "M12 2v4M5.6 5.6l2.8 2.8M2 12h4M18 12h4M15.6 8.4l2.8-2.8M8 22l4-4 4 4M12 18v-6",
  ];
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[index % paths.length]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ShopProductPage({ lang, product }: { lang: Locale; product: ShopProduct }) {
  const t = copy[lang];
  const title = lang === "it" ? product.titleIt : product.titleEn;
  const description = lang === "it" ? product.descriptionIt : product.descriptionEn;
  const details = product.details[lang];
  const label = details.label || SHOP_CATEGORY_LABEL[lang][product.category];
  const price = new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }).format(Number(product.price));

  return <>
    <SiteHeader />
    <main className="shop-page shop-product-page">
      <section className="sp-hero">
        <div className="sp-hero-inner">
          <ProductGallery lang={lang} title={title} images={product.images} />
          <div className="sp-details">
            <Link className="sp-back-link" data-shop-transition="back" href={localize("/shop", lang)}><ShopIcon name="arrowLeft" />{t.backToShop}</Link>
            <p className="sp-category">{label}<i /></p>
            <h1>{title}</h1>
            <p className="sp-description">{description}</p>
            <p className="sp-price">{price}</p>
            <ProductActions title={title} lang={lang} price={Number(product.price)} slug={product.slug} image={product.images[0] || "/images/shop/review-card-hero.webp"} />
            {details.highlights.length ? <div className="sp-trust">{details.highlights.map((item, index) => <div key={`${item}-${index}`}><BenefitIcon index={[2, 0, 3, 1][index % 4]} /><span>{item}</span></div>)}</div> : null}
            <p className="sp-made-order"><span />{t.madeToOrder}</p>
          </div>
        </div>
      </section>
      {details.benefits.length ? <section className="sp-benefits">
        <div className="sp-benefits-inner">
          {details.heading ? <h2>{details.heading}</h2> : null}
          <div className="sp-benefit-grid">{details.benefits.map(([heading, text], index) => <article key={`${heading}-${index}`}><BenefitIcon index={index} /><h3>{heading}</h3>{text ? <p>{text}</p> : null}</article>)}</div>
        </div>
      </section> : null}
      {product.slug === "google-review-card" ? <ProductManual lang={lang} /> : null}
      <section className="sp-reviews">
        <div className="sp-reviews-copy"><p className="sp-category">{t.reviewKicker}<i /></p><h2>{t.reviewTitle[0]}<br />{t.reviewTitle[1]}</h2><p>{t.reviewEmpty}</p></div>
        <div className="sp-review-placeholder"><span className="sp-review-mark" aria-hidden="true">CTRL®</span><p>{t.reviewEmpty}</p></div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
