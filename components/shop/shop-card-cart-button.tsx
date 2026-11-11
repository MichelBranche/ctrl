"use client";

import { useState } from "react";
import { ShopIcon } from "@/components/shop/shop-icons";
import type { Locale } from "@/lib/i18n";
import type { ShopProduct } from "@/lib/shop-data";

export function ShopCardCartButton({ product, lang }: { product: ShopProduct; lang: Locale }) {
  const [added, setAdded] = useState(false);
  function add() {
    try {
      const key = "ctrl-shop-cart";
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{ id: string; title: string; quantity: number; price?: number; slug?: string; image?: string }>;
      const title = lang === "it" ? product.titleIt : product.titleEn;
      const item = current.find((entry) => entry.id === product.slug);
      if (item) { item.quantity += 1; item.price = Number(product.price); item.slug = product.slug; item.image = product.images[0]; }
      else current.push({ id: product.slug, slug: product.slug, title, quantity: 1, price: Number(product.price), image: product.images[0] });
      window.localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: { open: true, bump: true } }));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch { /* Keep the product link available if browser storage is disabled. */ }
  }

  return <button type="button" className={added ? "shop-card-cart is-added" : "shop-card-cart"} aria-label={lang === "it" ? `Aggiungi ${product.titleIt} al carrello` : `Add ${product.titleEn} to cart`} onClick={add}>
    <ShopIcon name="cart" className="shop-card-cart-icon" /><ShopIcon name="check" className="shop-card-cart-check" />
  </button>;
}
