import { priceCart } from "@/lib/shop-cart-actions";

type Line = { id: string; slug?: string; title: string; quantity: number; price?: number };
const STORAGE_KEY = "ctrl-shop-cart";

/**
 * Replaces stored (possibly stale) cart prices and titles with the current server values.
 * Lines whose product is gone or hidden keep their data but lose the price (shown as "—").
 * Writes back to localStorage without the update event, so listeners don't loop.
 */
export async function refreshCartPrices<T extends Line>(items: T[], lang: "it" | "en"): Promise<T[] | null> {
  if (!items.length) return null;
  try {
    const quote = await priceCart(items.map((i) => ({ slug: i.slug ?? i.id, quantity: i.quantity })), lang);
    const bySlug = new Map(quote.lines.map((l) => [l.slug, l]));
    const next = items.map((i) => { const q = bySlug.get(i.slug ?? i.id); return { ...i, price: q?.unitPrice, title: q?.title ?? i.title }; });
    if (next.every((n, k) => n.price === items[k].price && n.title === items[k].title)) return null;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch { return null; }
}
