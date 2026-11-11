"use server";

import { quoteCart, type CartQuote } from "@/lib/shop";

/** Current server prices for the browser cart. Input is only slug + quantity; returned prices come from the database. */
export async function priceCart(lines: { slug: string; quantity: number }[], lang: "it" | "en"): Promise<CartQuote> {
  if (!Array.isArray(lines)) return { lines: [], subtotal: 0 };
  const clean = lines.slice(0, 50).filter((l) => l && typeof l.slug === "string" && l.slug.length <= 80).map((l) => ({ slug: l.slug, quantity: Number(l.quantity) }));
  return quoteCart(clean, lang === "en" ? "en" : "it");
}
