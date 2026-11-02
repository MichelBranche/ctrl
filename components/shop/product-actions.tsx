"use client";

import { useState } from "react";
import { ShopIcon } from "@/components/shop/shop-icons";
import type { Locale } from "@/lib/i18n";

export function ProductActions({ title, lang, price, slug, image }: { title: string; lang: Locale; price: number; slug: string; image: string }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const labels = lang === "it" ? { add: "Aggiungi al carrello", added: "Aggiunto al carrello", quantity: "Quantità" } : { add: "Add to cart", added: "Added to cart", quantity: "Quantity" };
  function addToCart() {
    try {
      const stored = window.localStorage.getItem("ctrl-shop-cart");
      const cart: Array<{ id: string; title: string; quantity: number; price?: number; slug?: string; image?: string }> = stored ? JSON.parse(stored) : [];
      const existing = cart.find((item) => item.id === slug);
      if (existing) { existing.quantity += quantity; existing.price = price; existing.slug = slug; existing.image = image; existing.title = title; }
      else cart.push({ id: slug, title, quantity, price, slug, image });
      window.localStorage.setItem("ctrl-shop-cart", JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: { open: true, bump: true } }));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    } catch {
      setAdded(false);
    }
  }
  return <>
    <div className="sp-buy-row">
      <div className="sp-quantity" aria-label={labels.quantity}>
        <button type="button" aria-label={lang === "it" ? "Diminuisci quantità" : "Decrease quantity"} disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><ShopIcon name="minus" /></button>
        <span aria-live="polite" key={quantity} className="sp-quantity-value">{quantity}</span>
        <button type="button" aria-label={lang === "it" ? "Aumenta quantità" : "Increase quantity"} disabled={quantity >= 99} onClick={() => setQuantity((value) => Math.min(99, value + 1))}><ShopIcon name="plus" /></button>
      </div>
      <button className={added ? "sp-add-cart is-added" : "sp-add-cart"} type="button" onClick={addToCart}><span className="sp-add-label">{added ? labels.added : labels.add}</span><span className="sp-add-icon"><ShopIcon name={added ? "check" : "arrowRight"} /></span></button>
    </div>
    <p className="sp-cart-status sr-only" role="status" aria-live="polite">{added ? labels.added : ""}</p>
  </>;
}
