import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Row } from "@libsql/client";
import { db, dbConfigured } from "@/lib/db";
import { ensureShopSchema } from "@/lib/migrate";
import { DEFAULT_SHOP_PRODUCT, GOOGLE_CARD_DETAILS, isShopCategory, parseDetails, type ShopProduct, type ShopProductAdmin } from "@/lib/shop-data";

export type { ShopProduct, ShopProductAdmin } from "@/lib/shop-data";
export { DEFAULT_SHOP_PRODUCT } from "@/lib/shop-data";
export const SHOP_PRODUCT_TAG = "shop-products";

const PUBLIC_COLUMNS = "id, slug, category, title_it, title_en, description_it, description_en, price, images_json, published, sort_order, created_at, details_json";

function toProduct(row: Row): ShopProduct {
  let images: unknown = [];
  try { images = JSON.parse(String(row.images_json)); } catch { images = []; }
  const details = parseDetails(row.details_json);
  // The Google card keeps its original copy until the admin writes its own.
  if (String(row.id) === DEFAULT_SHOP_PRODUCT.id) {
    if (!details.it.benefits.length && !details.it.highlights.length) details.it = GOOGLE_CARD_DETAILS.it;
    if (!details.en.benefits.length && !details.en.highlights.length) details.en = GOOGLE_CARD_DETAILS.en;
  }
  return {
    id: String(row.id), slug: String(row.slug), category: isShopCategory(row.category) ? row.category : "tech",
    titleIt: String(row.title_it), titleEn: String(row.title_en),
    descriptionIt: String(row.description_it), descriptionEn: String(row.description_en), price: String(row.price),
    images: Array.isArray(images) ? images.filter((image): image is string => typeof image === "string") : [],
    published: Number(row.published) === 1, sortOrder: Number(row.sort_order) || 0,
    createdAt: String(row.created_at ?? ""), details,
  };
}

async function queryShopProducts(): Promise<ShopProduct[]> {
  "use cache";
  cacheTag(SHOP_PRODUCT_TAG);
  // Short client stale time: admin edits invalidate the tag/paths at once, so a long browser router cache is the only thing that could still show an old price.
  cacheLife({ stale: 30, revalidate: 3600, expire: 86400 * 7 });
  // The schema check is DB I/O too: keep it inside the cache scope so prerendering /shop does no uncached data access.
  await ensureShopSchema();
  const result = await db().execute(`SELECT ${PUBLIC_COLUMNS} FROM shop_products ORDER BY sort_order, created_at`);
  return result.rows.map(toProduct);
}

/** Public catalogue (published and hidden; pages filter on `published`). Never contains supplier data. */
export async function getShopProducts(): Promise<ShopProduct[]> {
  if (!dbConfigured) return [DEFAULT_SHOP_PRODUCT];
  return queryShopProducts();
}

export async function getShopProduct(slug: string): Promise<ShopProduct | null> {
  const products = await getShopProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

/** Admin only (uncached): includes the translation flag and dropshipping supplier fields. */
export async function getShopProductsAdmin(): Promise<ShopProductAdmin[]> {
  if (!dbConfigured) return [{ ...DEFAULT_SHOP_PRODUCT, updatedAt: "", enAuto: true, supplierName: "", supplierProductUrl: "", supplierSku: "", supplierCost: "" }];
  await ensureShopSchema();
  const result = await db().execute("SELECT * FROM shop_products ORDER BY sort_order, created_at");
  return result.rows.map((row) => ({
    ...toProduct(row),
    updatedAt: String(row.updated_at ?? ""),
    enAuto: Number(row.en_auto) === 1,
    supplierName: String(row.supplier_name ?? ""),
    supplierProductUrl: String(row.supplier_product_url ?? ""),
    supplierSku: String(row.supplier_sku ?? ""),
    supplierCost: row.supplier_cost == null ? "" : String(row.supplier_cost),
  }));
}

export type CartLineInput = { slug: string; quantity: number };
export type CartQuote = { lines: { slug: string; title: string; unitPrice: number; quantity: number; total: number }[]; subtotal: number };

/**
 * Prices a cart on the server from the database. The browser cart (localStorage) only carries slug + quantity that matter here:
 * any price, title or image it holds is display-only and MUST NOT be used to charge. A future payment route (e.g. Stripe Checkout)
 * must build its line items from this function's output, never from the request body.
 */
export async function quoteCart(input: CartLineInput[], lang: "it" | "en"): Promise<CartQuote> {
  const products = await getShopProducts();
  const lines = input.slice(0, 50).flatMap((line) => {
    const product = products.find((p) => p.published && p.slug === line.slug);
    const quantity = Math.min(99, Math.max(0, Math.floor(Number(line.quantity) || 0)));
    if (!product || !quantity) return [];
    const unitPrice = Math.round(Number(product.price) * 100) / 100;
    return [{ slug: product.slug, title: lang === "it" ? product.titleIt : product.titleEn, unitPrice, quantity, total: Math.round(unitPrice * quantity * 100) / 100 }];
  });
  return { lines, subtotal: Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100 };
}
