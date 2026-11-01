import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductActions } from "@/components/shop/product-actions";
import type { ShopProduct } from "@/lib/shop";
import { localize, type Locale } from "@/lib/i18n";
import "./shop.css";

const copy = {
  it: {
    category: "Cards",
    backToShop: "Torna allo shop",
    benefitsTitle: "Un piccolo gesto. Più recensioni.",
    benefits: [
      ["Più recensioni", "Rendi semplice per i clienti raccontare la loro esperienza."],
      ["Più fiducia", "Aiuta i nuovi clienti a scoprire le opinioni di chi ti ha già scelto."],
      ["NFC + QR", "Funziona con un tap NFC o con la scansione del codice."],
      ["Sempre con te", "Un piccolo strumento, pronto da usare al banco."],
    ],
    reviewKicker: "Recensioni",
    reviewTitle: ["Cosa dicono", "i nostri clienti"],
    reviewEmpty: "Le recensioni verificate dei clienti saranno pubblicate qui appena disponibili.",
    madeToOrder: "Realizzata su ordinazione",
    support: ["NFC e QR", "Due modalità di accesso", "Assistenza dedicata"],
  },
  en: {
    category: "Cards",
    backToShop: "Back to shop",
    benefitsTitle: "One small gesture. More reviews.",
    benefits: [
      ["More reviews", "Make it easy for customers to share their experience."],
      ["More trust", "Help new customers discover feedback from people who chose you."],
      ["NFC + QR", "Works with an NFC tap or a quick scan."],
      ["Always at hand", "A small tool, ready to use at your counter."],
    ],
    reviewKicker: "Reviews",
    reviewTitle: ["What our", "customers say"],
    reviewEmpty: "Verified customer reviews will appear here when available.",
    madeToOrder: "Made to order",
    support: ["NFC and QR", "Two ways to open the link", "Dedicated support"],
  },
} as const;

function BenefitIcon({ index }: { index: number }) {
  const paths = [
    "M4 19v-5h4v5M10 19V9h4v10M16 19V4h4v15M3 21h18",
    "M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6zM8.5 12l2.2 2.2 4.8-5",
    "M4 5h16v14H4zM9 9l7 3-7 3z",
    "M12 2v4M5.6 5.6l2.8 2.8M2 12h4M18 12h4M15.6 8.4l2.8-2.8M8 22l4-4 4 4M12 18v-6",
  ];
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[index]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ShopProductPage({ lang, product }: { lang: Locale; product: ShopProduct }) {
  const t = copy[lang];
  const title = lang === "it" ? product.titleIt : product.titleEn;
  const description = lang === "it" ? product.descriptionIt : product.descriptionEn;
  const price = new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }).format(Number(product.price));

  return <>
    <SiteHeader />
    <main className="shop-page shop-product-page">
      <section className="sp-hero">
        <div className="sp-hero-inner">
          <ProductGallery lang={lang} />
          <div className="sp-details">
            <Link className="sp-back-link" href={localize("/shop", lang)}><span aria-hidden="true">←</span>{t.backToShop}</Link>
            <p className="sp-category">{t.category}<i /></p>
            <h1>{title}</h1>
            <p className="sp-description">{description}</p>
            <p className="sp-price">{price}</p>
            <ProductActions title={title} lang={lang} price={Number(product.price)} />
            <div className="sp-trust">{t.support.map((label, index) => <div key={label}><BenefitIcon index={index === 0 ? 2 : index === 1 ? 0 : 3} /><span>{label}</span></div>)}</div>
            <p className="sp-made-order"><span />{t.madeToOrder}</p>
          </div>
        </div>
      </section>
      <section className="sp-benefits">
        <div className="sp-benefits-inner">
          <h2>{t.benefitsTitle}</h2>
          <div className="sp-benefit-grid">{t.benefits.map(([heading, text], index) => <article key={heading}><BenefitIcon index={index} /><h3>{heading}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>
      <section className="sp-reviews">
        <div className="sp-reviews-copy"><p className="sp-category">{t.reviewKicker}<i /></p><h2>{t.reviewTitle[0]}<br />{t.reviewTitle[1]}</h2><p>{t.reviewEmpty}</p></div>
        <div className="sp-review-placeholder"><span className="sp-review-mark" aria-hidden="true">CTRL®</span><p>{t.reviewEmpty}</p></div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
