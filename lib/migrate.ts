import "server-only";
import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

/** Adds the translation columns to posts if missing (db/003_translations.sql). Idempotent, runs once per server instance. */
export function ensureTranslationSchema(): Promise<void> {
  ready ??= (async () => {
    const cols = await db().execute("PRAGMA table_info(posts)");
    const have = new Set(cols.rows.map((r) => String(r.name)));
    if (!have.has("translation_of")) await db().execute("ALTER TABLE posts ADD COLUMN translation_of TEXT");
    if (!have.has("auto_translated")) await db().execute("ALTER TABLE posts ADD COLUMN auto_translated INTEGER NOT NULL DEFAULT 0");
    await db().execute("CREATE INDEX IF NOT EXISTS posts_translation_of ON posts (translation_of)");
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

let shopReady: Promise<void> | null = null;

/** Shop tables (db/004_shop.sql) plus columns added later. Idempotent, runs once per server instance; seeds the Google review card once. */
export function ensureShopSchema(): Promise<void> {
  shopReady ??= (async () => {
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
    const cols = await db().execute("PRAGMA table_info(shop_products)");
    const have = new Set(cols.rows.map((r) => String(r.name)));
    const add: [string, string][] = [
      ["category", "TEXT NOT NULL DEFAULT 'tech'"],
      ["details_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["en_auto", "INTEGER NOT NULL DEFAULT 1"],
      ["supplier_name", "TEXT"],
      ["supplier_product_url", "TEXT"],
      ["supplier_sku", "TEXT"],
    ];
    for (const [name, type] of add) if (!have.has(name)) await db().execute(`ALTER TABLE shop_products ADD COLUMN ${name} ${type}`);
    const seeded = await db().execute("INSERT OR IGNORE INTO shop_meta (key, value) VALUES ('legacy-product-seeded', '1')");
    if (seeded.rowsAffected > 0) {
      const { seedDefaultShopProduct } = await import("@/lib/shop-seed");
      await seedDefaultShopProduct();
    }
  })().catch((error) => {
    shopReady = null;
    throw error;
  });
  return shopReady;
}
