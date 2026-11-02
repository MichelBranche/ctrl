"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { refreshCartPrices } from "@/lib/shop-cart-sync";

type CartItem = { id: string; title: string; quantity: number; price?: number; slug?: string; image?: string };
const STORAGE_KEY = "ctrl-shop-cart";
const labels = {
  it: { open: "Apri il carrello", title: "Il tuo carrello", close: "Chiudi carrello", empty: "Il carrello è vuoto.", shop: "Scopri lo shop", remove: "Rimuovi", subtotal: "Subtotale", return: "Torna allo shop", checkout: "Vai al checkout", decrease: "Diminuisci quantità", increase: "Aumenta quantità", unavailable: "—" },
  en: { open: "Open cart", title: "Your cart", close: "Close cart", empty: "Your cart is empty.", shop: "Discover the shop", remove: "Remove", subtotal: "Subtotal", return: "Back to shop", checkout: "Go to checkout", decrease: "Decrease quantity", increase: "Increase quantity", unavailable: "—" },
} as const;

function readCart(): CartItem[] {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is CartItem => !!item && typeof item.id === "string" && typeof item.title === "string" && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0)
      .map((item) => ({
        ...item,
        quantity: Math.floor(Number(item.quantity)),
        slug: item.slug || (item.id === "google-review-card" ? "google-review-card" : undefined),
        image: item.image || (item.id === "google-review-card" ? "/images/shop/review-card.webp" : undefined),
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
      }));
  } catch { return []; }
}

function writeCart(cart: CartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: cart }));
}

function CartGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6M10 20h.01M18 20h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CartDrawer({ lang }: { lang: Locale }) {
  const t = labels[lang];
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0), [items]);
  const money = useMemo(() => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-IE", { style: "currency", currency: "EUR" }), [lang]);
  const shopHref = lang === "en" ? "/en/shop" : "/shop";
  const checkoutHref = lang === "en" ? "/en/checkout" : "/checkout";
  const productHref = (item: CartItem) => item.slug ? `${lang === "en" ? "/en" : ""}/shop/${item.slug}` : shopHref;

  const sync = useCallback(() => {
    const cart = readCart();
    setItems(cart);
    void refreshCartPrices(cart, lang).then((fresh) => { if (fresh) setItems(fresh); });
  }, [lang]);
  useEffect(() => {
    sync();
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) sync(); };
    const onCartUpdate = (event: Event) => {
      sync();
      if (event instanceof CustomEvent && event.detail?.open) setOpen(true);
    };
    window.addEventListener("ctrl:shop-cart-updated", onCartUpdate);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("ctrl:shop-cart-updated", onCartUpdate); window.removeEventListener("storage", onStorage); };
  }, [sync]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); triggerRef.current?.focus(); };
  }, [open]);

  function updateQuantity(id: string, delta: number) {
    writeCart(items.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }
  function removeItem(id: string) { writeCart(items.filter((item) => item.id !== id)); }

  return <>
    <button ref={triggerRef} type="button" className="header-cart" aria-label={`${t.open}${count ? `, ${count}` : ""}`} aria-expanded={open} aria-controls="shop-cart-drawer" onClick={() => setOpen(true)}>
      <CartGlyph />{count > 0 && <span className="header-cart-count">{count > 99 ? "99+" : count}</span>}
    </button>
    {open && createPortal(<div className="cart-layer">
      <button className="cart-backdrop" type="button" aria-label={t.close} onClick={() => setOpen(false)} />
      <aside id="shop-cart-drawer" className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-drawer-head"><h2 id="cart-title">{t.title}<span>{count.toString().padStart(2, "0")}</span></h2><button ref={closeRef} type="button" className="cart-close" aria-label={t.close} onClick={() => setOpen(false)}>×</button></div>
        {items.length === 0 ? <div className="cart-empty"><p>{t.empty}</p><Link href={shopHref} onClick={() => setOpen(false)}>{t.shop}<span aria-hidden="true">→</span></Link></div> : <>
          <div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}>
            <Link className="cart-item-image" href={productHref(item)} onClick={() => setOpen(false)}><Image src={item.image || "/images/shop/review-card.webp"} alt="" fill sizes="96px" /></Link>
            <div className="cart-item-info"><div className="cart-item-title"><Link href={productHref(item)} onClick={() => setOpen(false)}>{item.title}</Link><button type="button" onClick={() => removeItem(item.id)} aria-label={`${t.remove}: ${item.title}`}>×</button></div><p>{item.price === undefined ? t.unavailable : money.format(item.price)}</p><div className="cart-item-quantity"><button type="button" aria-label={t.decrease} onClick={() => updateQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={t.increase} onClick={() => updateQuantity(item.id, 1)}>＋</button></div></div>
          </article>)}</div>
          <div className="cart-drawer-foot"><div className="cart-subtotal"><span>{t.subtotal}</span><strong>{money.format(subtotal)}</strong></div><Link className="cart-checkout" href={checkoutHref} onClick={() => setOpen(false)}>{t.checkout}<span aria-hidden="true">→</span></Link><Link className="cart-continue" href={shopHref} onClick={() => setOpen(false)}>{t.return}<span aria-hidden="true">↗</span></Link></div>
        </>}
      </aside>
    </div>, document.body)}
  </>;
}
