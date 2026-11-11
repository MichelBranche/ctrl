"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n";
import { ShopIcon } from "@/components/shop/shop-icons";
import { refreshCartPrices } from "@/lib/shop-cart-sync";
import { submitOrderRequest } from "@/lib/shop-order-actions";
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

const form = {
  it: {
    badge: "Richiesta d'ordine", title: "Richiesta d'ordine, ti contattiamo noi.",
    lead: "Nessun pagamento ora. Invia la richiesta: verifichiamo disponibilità e spedizione e ti contattiamo per confermare l'ordine.",
    name: "Nome e cognome", email: "Email", phone: "Telefono (facoltativo)", address: "Indirizzo di spedizione", addressHint: "Via, numero, CAP, città, provincia",
    custom: "Personalizzazione card NFC (facoltativa)", business: "Nome dell'attività", review: "Link alle recensioni Google", reviewHint: "https://g.page/r/…",
    note: "Note (facoltative)", privacy: "Usiamo questi dati solo per gestire la tua richiesta.", submit: "Invia richiesta d'ordine", sending: "Invio in corso…",
    done: (n: number) => `Richiesta n. ${n} inviata. Ti contattiamo noi a breve.`, doneLead: "Ti abbiamo riservato i prezzi indicati: ti scriviamo per confermare l'ordine e la spedizione.",
    errors: { invalid: "Controlla nome, email, indirizzo (e il link, se inserito: deve iniziare con https://).", empty: "Il carrello non contiene prodotti disponibili.", rate: "Troppe richieste: riprova tra un po'.", unavailable: "Invio non riuscito. Riprova più tardi o scrivici dalla pagina contatti." },
    cta: "Compila la richiesta d'ordine",
  },
  en: {
    badge: "Order request", title: "Order request, we'll contact you.",
    lead: "No payment now. Send the request: we check availability and shipping and get back to you to confirm the order.",
    name: "Full name", email: "Email", phone: "Phone (optional)", address: "Shipping address", addressHint: "Street, number, postcode, city, country",
    custom: "NFC card customisation (optional)", business: "Business name", review: "Google reviews link", reviewHint: "https://g.page/r/…",
    note: "Notes (optional)", privacy: "We only use this data to handle your request.", submit: "Send order request", sending: "Sending…",
    done: (n: number) => `Request no. ${n} sent. We'll contact you shortly.`, doneLead: "We've noted the prices shown: we'll email you to confirm the order and shipping.",
    errors: { invalid: "Check name, email and address (and the link, if any: it must start with https://).", empty: "Your cart has no available products.", rate: "Too many requests: please try again later.", unavailable: "Sending failed. Please try later or write to us from the contact page." },
    cta: "Fill in the order request",
  },
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
    let live = true;
    queueMicrotask(() => { if (live) setItems(cart); });
    void refreshCartPrices(cart, lang).then((fresh) => { if (fresh && live) setItems(fresh); });
    return () => { live = false; };
  }, [lang]);
  const f = form[lang];
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const send = (data: FormData) => start(async () => {
    setError("");
    data.set("lang", lang);
    data.set("cart", JSON.stringify(items.filter((i) => i.slug).map((i) => ({ slug: i.slug, quantity: i.quantity }))));
    const res = await submitOrderRequest(data).catch(() => ({ ok: false as const, error: "unavailable" as const }));
    if (!res.ok) { setError(f.errors[res.error]); return; }
    try { window.localStorage.setItem("ctrl-shop-cart", "[]"); } catch { /* storage blocked */ }
    window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: { open: false } }));
    setDone(res.number);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setItems([]);
  });
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  const shopHref = lang === "en" ? "/en/shop" : "/shop";
  const productHref = (item: CartLine) => item.slug ? `${lang === "en" ? "/en" : ""}/shop/${item.slug}` : shopHref;

  return <main className="shop-page checkout-page">
    <section className="checkout-shell">
      <div className="checkout-intro"><p className="sp-category">{t.kicker}<i /></p><h1>{t.title}</h1><p>{t.lead}</p></div>
      {done !== null ? <div className="checkout-empty checkout-done" role="status"><ShopIcon name="check" className="checkout-empty-icon" /><p>{done ? f.done(done) : f.done(0).replace(" n. 0", "").replace(" no. 0", "")}</p><p className="checkout-done-lead">{f.doneLead}</p><Link className="cart-checkout" href={shopHref}>{t.back}<ShopIcon name="arrowRight" /></Link></div> : items.length === 0 ? <div className="checkout-empty"><ShopIcon name="bag" className="checkout-empty-icon" /><p>{t.empty}</p><Link className="cart-checkout" href={shopHref}>{t.back}<ShopIcon name="arrowRight" /></Link></div> : <div className="checkout-layout">
        <section className="checkout-lines"><h2>{t.summary}<span>{items.reduce((n, item) => n + item.quantity, 0).toString().padStart(2, "0")}</span></h2>
          {items.map((item) => <article className="checkout-line" key={item.id}>
            <Link className="checkout-image" href={productHref(item)}><Image src={item.image || "/images/shop/review-card.webp"} alt="" fill sizes="88px" /></Link>
            <div><Link className="checkout-name" href={productHref(item)}>{item.title}</Link><p>{lang === "it" ? "Quantità" : "Quantity"}: {item.quantity}</p></div>
            <strong>{item.price === undefined ? t.unavailable : money.format(item.price * item.quantity)}</strong>
          </article>)}
          <form id="order-request" className="checkout-request" action={send} aria-busy={pending}>
            <p className="checkout-request-badge">{f.badge}</p>
            <h2>{f.title}</h2>
            <p className="checkout-request-lead">{f.lead}</p>
            <div className="checkout-fields">
              <label><span>{f.name}</span><input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
              <label><span>{f.email}</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
              <label><span>{f.phone}</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
              <label className="is-wide"><span>{f.address}</span><textarea name="address" required minLength={8} maxLength={600} rows={2} placeholder={f.addressHint} autoComplete="street-address" /></label>
            </div>
            <fieldset className="checkout-fields"><legend>{f.custom}</legend>
              <label><span>{f.business}</span><input name="business_name" maxLength={160} autoComplete="organization" /></label>
              <label><span>{f.review}</span><input name="review_url" type="url" maxLength={500} placeholder={f.reviewHint} /></label>
              <label className="is-wide"><span>{f.note}</span><textarea name="note" maxLength={1000} rows={2} /></label>
            </fieldset>
            <label className="checkout-hp" aria-hidden="true">Website<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
            {error ? <p className="checkout-error" role="alert">{error}</p> : null}
            <button type="submit" className="cart-checkout checkout-submit" disabled={pending}>{pending ? f.sending : f.submit}<ShopIcon name="arrowRight" /></button>
            <p className="checkout-privacy">{f.privacy}</p>
          </form>
          <p className="checkout-note">{t.note}</p>
        </section>
        <aside className="checkout-totals"><h2>{lang === "it" ? "Riepilogo" : "Summary"}</h2><div><span>{t.subtotal}</span><strong>{money.format(subtotal)}</strong></div><div><span>{t.shipping}</span><strong>{t.later}</strong></div><div className="checkout-total"><span>{t.total}</span><strong>{money.format(subtotal)}</strong></div><a className="checkout-totals-cta" href="#order-request">{f.cta}<ShopIcon name="arrowRight" /></a><p className="checkout-totals-hint">{lang === "it" ? "Pagamento online non ancora attivo: nessun addebito." : "Online payment not active yet: nothing is charged."}</p><Link href={shopHref}>{t.back}<ShopIcon name="arrowUpRight" /></Link></aside>
      </div>}
    </section>
  </main>;
}
