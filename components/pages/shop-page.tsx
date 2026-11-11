import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import type { Locale } from "@/lib/i18n";
import type { ShopProduct } from "@/lib/shop-data";
import "./shop.css";

const copy = {
  it: { kicker: "SHOP", title: "Shop.", lead: ["Card NFC per le recensioni.", "E gli altri essenziali CTRL®."], madeToOrder: "Realizzata su ordinazione", none: "Stiamo preparando il prossimo drop." },
  en: { kicker: "SHOP", title: "Shop.", lead: ["NFC cards for reviews.", "And the other CTRL® essentials."], madeToOrder: "Made to order", none: "We’re preparing the next drop." },
} as const;

export function ShopPage({ lang, products }: { lang: Locale; products: ShopProduct[] }) {
  const t = copy[lang];
  const visible = products.filter((product) => product.published);

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
          {visible.length ? <ShopCatalog lang={lang} products={visible} /> : <div className="shop-main shop-main-full"><div className="shop-empty"><p>{t.none}</p></div></div>}
          <div className="shop-main shop-order-wrap">
            <div className="shop-order-note"><span />{t.madeToOrder}</div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
