"use client";

import { useState } from "react";
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
      window.dispatchEvent(new CustomEvent("ctrl:shop-cart-updated", { detail: { open: true } }));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    } catch {
      setAdded(false);
    }
  }
  return <>
    <div className="sp-buy-row">
      <div className="sp-quantity" aria-label={labels.quantity}>
        <button type="button" aria-label={lang === "it" ? "Diminuisci quantità" : "Decrease quantity"} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
        <span aria-live="polite">{quantity}</span>
        <button type="button" aria-label={lang === "it" ? "Aumenta quantità" : "Increase quantity"} onClick={() => setQuantity((value) => value + 1)}>＋</button>
      </div>
      <button className="sp-add-cart" type="button" onClick={addToCart}><span aria-hidden="true">↗</span>{labels.add}<span aria-hidden="true">→</span></button>
    </div>
    <p className="sp-cart-status" role="status" aria-live="polite">{added ? labels.added : ""}</p>
  </>;
}
