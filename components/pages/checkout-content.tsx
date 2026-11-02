"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { ShopIcon } from "@/components/shop/shop-icons";
import { refreshCartPrices } from "@/lib/shop-cart-sync";
import "./shop.css";

/**
 * PRICE TRUST: this page and the cart drawer read prices from localStorage, which the visitor can edit.
 * They are display-only. When payments are enabled, the payment route must receive only { slug, quantity }
 * and build the amount on the server with quoteCart() in lib/shop.ts (prices from the database), never from this data.
 */
type CartLine = { id: string; slug?: string; title: string; quantity: number; price?: number; image?: string };
const text = {
  it: { kicker: "SHOP / CHECKOUT", title: "Checkout.", lead: "Rivedi il tuo ordine prima di proseguire.", summary: "Il tuo ordine", empty: "Il carrello è vuoto.", back: "Torna allo shop", subtotal: "Subtotale", shipping: "Spedizione", later: "Da definire", total: "Totale", note: "Il checkout online e i pagamenti saranno attivati dopo la scelta del servizio di pagamento e della fornitura. Per ora il carrello è una bozza salvata in questo browser: i prezzi definitivi saranno sempre ricalcolati dal nostro server.", unavailable: "—" },
  en: { kicker: "SHOP / CHECKOUT", title: "Checkout.", lead: "Review your order before continuing.", summary: "Your order", empty: "Your cart is empty.", back: "Back to shop", subtotal: "Subtotal", shipping: "To be confirmed", later: "To be confirmed", total: "Total", note: "Online checkout and payments will be enabled after a payment and fulfillment service is chosen. For now, your cart is a draft saved in this browser: final prices will always be recalculated by our server.", unavailable: "—" },
} as const;

export function CheckoutContent({ lang }: { lang: Locale }) {
  const t = text[lang];
  const [items, setItems] = useState<CartLine[]>([]);
  const money = useMemo(() => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }), [lang]);
  useEffect(() => {
    let cart: CartLine[] = [];
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem("ctrl-shop-cart") ?? "[]");
      if (Array.isArray(stored)) cart = stored.filter((item): item is CartLine => !!item && typeof item.id === "string" && typeof item.title === "string" && Number(item.quantity) > 0).map((item) => ({
        ...item,
        slug: item.slug || (item.id === "google-review-card" ? "google-review-card" : undefined),
        image: item.image || (item.id === "google-review-card" ? "/images/shop/review-card.webp" : undefined),
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
      }));
    } catch { cart = []; }
    setItems(cart);
    void refreshCartPrices(cart, lang).then((fresh) => { if (fresh) setItems(fresh); });
  }, [lang]);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  const shopHref = lang === "en" ? "/en/shop" : "/shop";
  const productHref = (item: CartLine) => item.slug ? `${lang === "en" ? "/en" : ""}/shop/${item.slug}` : shopHref;

  return <main className="shop-page checkout-page">
    <section className="checkout-shell">
      <div className="checkout-intro"><p className="sp-category">{t.kicker}<i /></p><h1>{t.title}</h1><p>{t.lead}</p></div>
      {items.length === 0 ? <div className="checkout-empty"><ShopIcon name="bag" className="checkout-empty-icon" /><p>{t.empty}</p><Link className="cart-checkout" href={shopHref}>{t.back}<ShopIcon name="arrowRight" /></Link></div> : <div className="checkout-layout">
        <section className="checkout-lines"><h2>{t.summary}<span>{items.reduce((n, item) => n + item.quantity, 0).toString().padStart(2, "0")}</span></h2>
          {items.map((item) => <article className="checkout-line" key={item.id}>
            <Link className="checkout-image" href={productHref(item)}><Image src={item.image || "/images/shop/review-card.webp"} alt="" fill sizes="88px" /></Link>
            <div><Link className="checkout-name" href={productHref(item)}>{item.title}</Link><p>{lang === "it" ? "Quantità" : "Quantity"}: {item.quantity}</p></div>
            <strong>{item.price === undefined ? t.unavailable : money.format(item.price * item.quantity)}</strong>
          </article>)}
          <p className="checkout-note">{t.note}</p>
        </section>
        <aside className="checkout-totals"><h2>{lang === "it" ? "Riepilogo" : "Summary"}</h2><div><span>{t.subtotal}</span><strong>{money.format(subtotal)}</strong></div><div><span>{t.shipping}</span><strong>{t.later}</strong></div><div className="checkout-total"><span>{t.total}</span><strong>{money.format(subtotal)}</strong></div><button type="button" disabled>{lang === "it" ? "Pagamento non ancora attivo" : "Payment is not active yet"}</button><Link href={shopHref}>{t.back}<ShopIcon name="arrowUpRight" /></Link></aside>
      </div>}
    </section>
  </main>;
}
