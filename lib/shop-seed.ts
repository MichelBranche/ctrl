import "server-only";
import { db } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { DEFAULT_SHOP_PRODUCT as D } from "@/lib/shop-data";

const LEGACY_KEYS = [
  "shop.product.published", "shop.product.title.it", "shop.product.title.en",
  "shop.product.description.it", "shop.product.description.en", "shop.product.price",
];

/** One-time seed of the Google review card (carries over the earlier settings-based values if present). */
export async function seedDefaultShopProduct() {
  const legacy = await readSettings(LEGACY_KEYS).catch((): Record<string, string> => ({}));
  const published = legacy["shop.product.published"] === undefined ? D.published : legacy["shop.product.published"] === "true";
  await db().execute({
    sql: `INSERT OR IGNORE INTO shop_products (id, slug, category, title_it, title_en, description_it, description_en, price, images_json, published, sort_order, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [D.id, D.slug, D.category, legacy["shop.product.title.it"] ?? D.titleIt, legacy["shop.product.title.en"] ?? D.titleEn,
      legacy["shop.product.description.it"] ?? D.descriptionIt, legacy["shop.product.description.en"] ?? D.descriptionEn,
      legacy["shop.product.price"] ?? D.price, JSON.stringify(D.images), published ? 1 : 0, D.sortOrder, JSON.stringify(D.details)],
  });
  // Rows seeded before details existed: give the card its original page copy.
  await db().execute({ sql: "UPDATE shop_products SET details_json = ? WHERE id = ? AND details_json = '{}'", args: [JSON.stringify(D.details), D.id] });
}
