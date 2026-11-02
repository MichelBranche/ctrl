"use client";

import type { Locale } from "@/lib/i18n";
import type { ShopProduct } from "@/lib/shop";

export function ShopCardCartButton({ product, lang }: { product: ShopProduct; lang: Locale }) {
  function add() {
    try {
      const key = "ctrl-shop-cart";
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{ id: string; title: string; quantity: number; price?: number; slug?: string; image?: string }>;
      const title = lang === "it" ? product.titleIt : product.titleEn;
      const item = current.find((entry) => entry.id === product.slug);
      if (item) { item.quantity += 1; item.price = Number(product.price); item.slug = product.slug; item.image = product.images[0]; }
      else current.push({ id: product.slug, slug: product.slug, title, quantity: 1, price: Number(product.price), image: product.images[0] });
      window.localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: { open: true } }));
    } catch { /* Keep the product link available if browser storage is disabled. */ }
  }

  return <button type="button" className="shop-card-cart" aria-label={lang === "it" ? `Aggiungi ${product.titleIt} al carrello` : `Add ${product.titleEn} to cart`} onClick={add}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6M10 20h.01M18 20h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>;
}
