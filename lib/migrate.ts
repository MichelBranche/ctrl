import "server-only";
import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

/**
 * Runs an idempotent migration, retrying when another process holds the write lock
 * (SQLITE_BUSY / "database is locked"): `next build` collects page data in parallel workers.
 */
async function retryBusy(run: () => Promise<void>, tries = 6): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const busy = /SQLITE_BUSY|database is locked/i.test(String((error as Error)?.message ?? error));
      if (!busy || attempt >= tries) throw error;
      await new Promise((r) => setTimeout(r, 150 * 2 ** attempt + Math.random() * 150));
    }
  }
}

/**
 * ALTER TABLE … ADD COLUMN that tolerates a concurrent migrator (parallel build workers or
 * serverless instances) having added the column between our PRAGMA check and the ALTER.
 */
async function addColumn(table: string, name: string, type: string): Promise<void> {
  try {
    await db().execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  } catch (error) {
    if (/duplicate column name/i.test(String((error as Error)?.message ?? error))) return;
    throw error;
  }
}

/** Adds the translation columns to posts if missing (db/003_translations.sql). Idempotent, runs once per server instance. */
export function ensureTranslationSchema(): Promise<void> {
  ready ??= retryBusy(async () => {
    const cols = await db().execute("PRAGMA table_info(posts)");
    const have = new Set(cols.rows.map((r) => String(r.name)));
    if (!have.has("translation_of")) await addColumn("posts", "translation_of", "TEXT");
    if (!have.has("auto_translated")) await addColumn("posts", "auto_translated", "INTEGER NOT NULL DEFAULT 0");
    await db().execute("CREATE INDEX IF NOT EXISTS posts_translation_of ON posts (translation_of)");
  }).catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

let shopReady: Promise<void> | null = null;

/** Shop tables (db/004_shop.sql) plus columns added later. Idempotent, runs once per server instance; seeds the Google review card once. */
export function ensureShopSchema(): Promise<void> {
  shopReady ??= retryBusy(async () => {
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
      ["supplier_cost", "TEXT"],
    ];
    for (const [name, type] of add) if (!have.has(name)) await addColumn("shop_products", name, type);
    // Orders: no payment yet, so every public order starts as an "order request" (status 'richiesta').
    await db().batch([
      { sql: `CREATE TABLE IF NOT EXISTS shop_orders (
        id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'richiesta',
        customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT, address TEXT NOT NULL,
        business_name TEXT, review_url TEXT, customer_note TEXT, lang TEXT NOT NULL DEFAULT 'it',
        subtotal REAL NOT NULL DEFAULT 0, shipping REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
        supplier_cost_total REAL NOT NULL DEFAULT 0, tracking_number TEXT, tracking_url TEXT, notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        confirmed_at TEXT, ordered_at TEXT, shipped_at TEXT, delivered_at TEXT, cancelled_at TEXT
      )` },
      { sql: `CREATE TABLE IF NOT EXISTS shop_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
        slug TEXT NOT NULL, title TEXT NOT NULL, unit_price REAL NOT NULL, quantity INTEGER NOT NULL,
        line_total REAL NOT NULL, supplier_cost REAL
      )` },
      { sql: "CREATE INDEX IF NOT EXISTS shop_orders_created ON shop_orders (created_at)" },
      { sql: "CREATE INDEX IF NOT EXISTS shop_orders_status ON shop_orders (status)" },
      { sql: "CREATE INDEX IF NOT EXISTS shop_order_items_order ON shop_order_items (order_id)" },
    ], "write");
    const seeded = await db().execute("INSERT OR IGNORE INTO shop_meta (key, value) VALUES ('legacy-product-seeded', '1')");
    if (seeded.rowsAffected > 0) {
      const { seedDefaultShopProduct } = await import("@/lib/shop-seed");
      await seedDefaultShopProduct();
    }
  }).catch((error) => {
    shopReady = null;
    throw error;
  });
  return shopReady;
}

let teamReady: Promise<void> | null = null;

/**
 * Team accounts and paid jobs (db/005_team.sql). Idempotent (CREATE … IF NOT EXISTS, addColumn), retried on
 * SQLITE_BUSY so parallel build workers / serverless instances can race safely. Runs once per server instance.
 * The founder row itself is seeded from the legacy env login by lib/admin.ts (it needs the env values).
 */
export function ensureTeamSchema(): Promise<void> {
  teamReady ??= retryBusy(async () => {
    await db().batch([
      { sql: `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member', area TEXT, password_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )` },
      { sql: `CREATE TABLE IF NOT EXISTS team_jobs (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        client TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, date TEXT NOT NULL,
        area TEXT NOT NULL, created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )` },
      { sql: "CREATE INDEX IF NOT EXISTS team_jobs_user_date ON team_jobs (user_id, date)" },
      { sql: "CREATE INDEX IF NOT EXISTS team_jobs_date ON team_jobs (date)" },
    ], "write");
    // Columns added after the first release of these tables go here via addColumn (tolerates concurrent migrators).
    const cols = await db().execute("PRAGMA table_info(admin_users)");
    const have = new Set(cols.rows.map((r) => String(r.name)));
    for (const name of ["contact_email", "phone", "website"]) if (!have.has(name)) await addColumn("admin_users", name, "TEXT");
    if (!have.has("avatar_url")) await addColumn("admin_users", "avatar_url", "TEXT");
    if (!have.has("last_login_at")) await addColumn("admin_users", "last_login_at", "TEXT");
    if (!have.has("email_access")) await addColumn("admin_users", "email_access", "INTEGER NOT NULL DEFAULT 0");
  }).catch((error) => {
    teamReady = null;
    throw error;
  });
  return teamReady;
}

let emailReady: Promise<void> | null = null;

/**
 * Shared-inbox collaboration state (db/006_email.sql). Only metadata keyed by the RFC Message-ID hash:
 * who read / claimed a message and a send log. Email bodies are never stored. Idempotent, parallel-safe.
 */
export function ensureEmailSchema(): Promise<void> {
  emailReady ??= retryBusy(async () => {
    await db().batch([
      { sql: `CREATE TABLE IF NOT EXISTS email_reads (
        message_key TEXT NOT NULL, user_id TEXT NOT NULL,
        read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (message_key, user_id)
      )` },
      { sql: `CREATE TABLE IF NOT EXISTS email_claims (
        message_key TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        claimed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )` },
      { sql: `CREATE TABLE IF NOT EXISTS email_send_log (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, recipients TEXT NOT NULL, subject TEXT NOT NULL,
        in_reply_to TEXT, message_id TEXT, ok INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )` },
      { sql: "CREATE INDEX IF NOT EXISTS email_send_log_user_time ON email_send_log (user_id, created_at)" },
    ], "write");
  }).catch((error) => {
    emailReady = null;
    throw error;
  });
  return emailReady;
}
