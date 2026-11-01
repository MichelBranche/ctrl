import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, dbConfigured } from "@/lib/db";
import { readSettings } from "@/lib/settings";

export const SHOP_PRODUCT_TAG = "shop-products";
export type ShopProduct = {
  id: string;
  slug: string;
  titleIt: string;
  titleEn: string;
  descriptionIt: string;
  descriptionEn: string;
  price: string;
  images: string[];
  published: boolean;
  sortOrder: number;
};

export const DEFAULT_SHOP_PRODUCT: ShopProduct = {
  id: "google-review-card",
  slug: "google-review-card",
  published: true,
  titleIt: "Card recensioni Google",
  titleEn: "Google Review Card",
  descriptionIt: "Invita i clienti a lasciare una recensione con un semplice tap NFC o una scansione del QR code.",
  descriptionEn: "Invite customers to leave a review with a quick NFC tap or a scan of the QR code.",
  price: "19.90",
  images: ["/images/shop/review-card-hero.webp", "/images/shop/review-card.webp", "/images/shop/review-card-detail.webp"],
  sortOrder: 0,
};

const LEGACY_KEYS = [
  "shop.product.published", "shop.product.title.it", "shop.product.title.en",
  "shop.product.description.it", "shop.product.description.en", "shop.product.price",
];
let shopSchemaReady: Promise<void> | null = null;

export async function ensureShopSchema() {
  if (!dbConfigured) return;
  shopSchemaReady ??= (async () => {
    await db().batch([
      { sql: `CREATE TABLE IF NOT EXISTS shop_products (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title_it TEXT NOT NULL, title_en TEXT NOT NULL,
        description_it TEXT NOT NULL, description_en TEXT NOT NULL, price TEXT NOT NULL,
        images_json TEXT NOT NULL DEFAULT '[]', published INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )` },
      { sql: "CREATE TABLE IF NOT EXISTS shop_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)" },
    ], "write");
    const seeded = await db().execute({ sql: "INSERT OR IGNORE INTO shop_meta (key, value) VALUES ('legacy-product-seeded', '1')" });
    if (seeded.rowsAffected > 0) {
      const legacy = await readSettings(LEGACY_KEYS).catch((): Record<string, string> => ({}));
      const product = {
        ...DEFAULT_SHOP_PRODUCT,
        published: legacy["shop.product.published"] === undefined ? DEFAULT_SHOP_PRODUCT.published : legacy["shop.product.published"] === "true",
        titleIt: legacy["shop.product.title.it"] ?? DEFAULT_SHOP_PRODUCT.titleIt,
        titleEn: legacy["shop.product.title.en"] ?? DEFAULT_SHOP_PRODUCT.titleEn,
        descriptionIt: legacy["shop.product.description.it"] ?? DEFAULT_SHOP_PRODUCT.descriptionIt,
        descriptionEn: legacy["shop.product.description.en"] ?? DEFAULT_SHOP_PRODUCT.descriptionEn,
        price: legacy["shop.product.price"] ?? DEFAULT_SHOP_PRODUCT.price,
      };
      await db().execute({
        sql: `INSERT OR IGNORE INTO shop_products (id, slug, title_it, title_en, description_it, description_en, price, images_json, published, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [product.id, product.slug, product.titleIt, product.titleEn, product.descriptionIt, product.descriptionEn, product.price, JSON.stringify(product.images), product.published ? 1 : 0, product.sortOrder],
      });
    }
  })().catch((error) => { shopSchemaReady = null; throw error; });
  return shopSchemaReady;
}

async function queryShopProducts(): Promise<ShopProduct[]> {
  "use cache";
  cacheTag(SHOP_PRODUCT_TAG);
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 * 7 });
  const result = await db().execute("SELECT * FROM shop_products ORDER BY sort_order, created_at");
  return result.rows.map((row) => {
    let images: string[] = [];
    try { images = JSON.parse(String(row.images_json)); } catch { images = []; }
    return {
      id: String(row.id), slug: String(row.slug), titleIt: String(row.title_it), titleEn: String(row.title_en),
      descriptionIt: String(row.description_it), descriptionEn: String(row.description_en), price: String(row.price),
      images: Array.isArray(images) ? images.filter((image): image is string => typeof image === "string") : [],
      published: Number(row.published) === 1, sortOrder: Number(row.sort_order) || 0,
    };
  });
}

export async function getShopProducts(): Promise<ShopProduct[]> {
  await ensureShopSchema();
  if (!dbConfigured) return [DEFAULT_SHOP_PRODUCT];
  return queryShopProducts();
}

export async function getShopProduct(slug = DEFAULT_SHOP_PRODUCT.slug): Promise<ShopProduct | null> {
  const products = await getShopProducts();
  return products.find((product) => product.slug === slug) ?? null;
}
