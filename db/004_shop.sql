-- Shop products. Applied idempotently at runtime by ensureShopSchema() in lib/migrate.ts.
CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_it TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_it TEXT NOT NULL,
  description_en TEXT NOT NULL,
  price TEXT NOT NULL,                       -- euro, 2 decimals; the only price the server trusts
  images_json TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  category TEXT NOT NULL DEFAULT 'tech',     -- tech | merch | accessories | gift
  details_json TEXT NOT NULL DEFAULT '{}',   -- {it:{label,heading,benefits:[[t,d]],highlights:[]}, en:{...}}
  en_auto INTEGER NOT NULL DEFAULT 1,        -- 1 = English kept in sync by DeepL, 0 = edited by hand
  supplier_name TEXT,                        -- dropshipping, admin only, never public
  supplier_product_url TEXT,
  supplier_sku TEXT
);
CREATE TABLE IF NOT EXISTS shop_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
