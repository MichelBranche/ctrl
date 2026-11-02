"use server";

import { revalidatePath } from "next/cache";
import { db, dbConfigured } from "@/lib/db";
import { ensureShopSchema } from "@/lib/migrate";
import { allow } from "@/lib/request-guard";
import { quoteCart } from "@/lib/shop";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export type OrderRequestResult = { ok: true; number: number } | { ok: false; error: "invalid" | "empty" | "rate" | "unavailable" };

/**
 * Public ORDER REQUEST while payments are disabled: nothing is charged. The browser sends only slug + quantity (JSON in `cart`);
 * titles and prices are rebuilt here with quoteCart() from the database, supplier costs are read server-side and never returned.
 */
export async function submitOrderRequest(form: FormData): Promise<OrderRequestResult> {
  if (clip(form, "company_site", 200)) return { ok: true, number: 0 }; // honeypot: silent fake success
  const lang = form.get("lang") === "en" ? "en" : "it";
  const name = clip(form, "name", 120);
  const email = clip(form, "email", 200).toLowerCase();
  const phone = clip(form, "phone", 40);
  const address = clip(form, "address", 600);
  const businessName = clip(form, "business_name", 160);
  const reviewUrl = clip(form, "review_url", 500);
  const note = clip(form, "note", 1000);
  if (name.length < 2 || !EMAIL.test(email) || address.length < 8) return { ok: false, error: "invalid" };
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) return { ok: false, error: "invalid" };
  if (reviewUrl && !/^https:\/\/\S+$/i.test(reviewUrl)) return { ok: false, error: "invalid" };
  let lines: { slug: string; quantity: number }[] = [];
  try {
    const raw: unknown = JSON.parse(clip(form, "cart", 5000) || "[]");
    if (Array.isArray(raw)) lines = raw.slice(0, 50).filter((l) => l && typeof l.slug === "string" && l.slug.length <= 80).map((l) => ({ slug: String(l.slug), quantity: Number(l.quantity) }));
  } catch { return { ok: false, error: "invalid" }; }
  if (!dbConfigured) return { ok: false, error: "unavailable" };
  try {
    if (!(await allow("order", 5, 3_600_000))) return { ok: false, error: "rate" };
    await ensureShopSchema();
    const quote = await quoteCart(lines, lang);
    if (!quote.lines.length) return { ok: false, error: "empty" };
    const costs = await db().execute({
      sql: `SELECT slug, supplier_cost FROM shop_products WHERE slug IN (${quote.lines.map(() => "?").join(", ")})`,
      args: quote.lines.map((l) => l.slug),
    });
    const costOf = new Map(costs.rows.map((r) => [String(r.slug), r.supplier_cost == null ? null : Number(r.supplier_cost)]));
    const costTotal = quote.lines.reduce((s, l) => s + (costOf.get(l.slug) ?? 0) * l.quantity, 0);
    const id = crypto.randomUUID();
    // One write batch = one transaction: the order and its lines are stored together or not at all.
    const [inserted] = await db().batch([
      {
        sql: `INSERT INTO shop_orders (id, number, status, customer_name, customer_email, customer_phone, address, business_name, review_url, customer_note, lang, subtotal, total, supplier_cost_total)
              SELECT ?, COALESCE(MAX(number), 1000) + 1, 'richiesta', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM shop_orders RETURNING number`,
        args: [id, name, email, phone || null, address, businessName || null, reviewUrl || null, note || null, lang, quote.subtotal, quote.subtotal, Math.round(costTotal * 100) / 100],
      },
      ...quote.lines.map((l) => ({
        sql: "INSERT INTO shop_order_items (order_id, slug, title, unit_price, quantity, line_total, supplier_cost) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [id, l.slug, l.title, l.unitPrice, l.quantity, l.total, costOf.get(l.slug) ?? null],
      })),
    ], "write");
    revalidatePath("/admin/shop");
    return { ok: true, number: Number(inserted.rows[0]?.number ?? 0) };
  } catch (error) {
    console.error("[shop] order request failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "unavailable" };
  }
}
