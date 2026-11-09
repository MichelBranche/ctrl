import "server-only";
import { db } from "@/lib/db";
import { LEGACY_AREA_ROLE } from "@/lib/team-types";

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
    if (!have.has("last_name")) await addColumn("admin_users", "last_name", "TEXT");
    // Team invites (db/011_team_roles_invites.sql): only the SHA-256 of the token is stored.
    for (const [name, type] of [["invite_state", "TEXT"], ["invite_hash", "TEXT"], ["invite_expires_at", "INTEGER"], ["invite_sent_at", "INTEGER"],
      ["invite_window_at", "INTEGER"], ["invite_window_count", "INTEGER NOT NULL DEFAULT 0"], ["invited_by", "TEXT"], ["removed_at", "TEXT"], ["removed_by", "TEXT"]] as const)
      if (!have.has(name)) await addColumn("admin_users", name, type);
    await db().batch([
      { sql: `CREATE TABLE IF NOT EXISTS admin_user_roles (
        user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, role TEXT NOT NULL, PRIMARY KEY (user_id, role)
      )` },
      { sql: "CREATE UNIQUE INDEX IF NOT EXISTS admin_users_invite_hash ON admin_users (invite_hash) WHERE invite_hash IS NOT NULL" },
    ], "write");
    await backfillRoles();
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
      { sql: `CREATE TABLE IF NOT EXISTS email_workflow (
  message_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'todo', updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)` },
      { sql: `CREATE TABLE IF NOT EXISTS email_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_key TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)` },
      { sql: `CREATE INDEX IF NOT EXISTS email_notes_message ON email_notes(message_key, id)` },
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
      { sql: "CREATE INDEX IF NOT EXISTS email_claims_user ON email_claims (user_id, claimed_at)" },
    ], "write");
  }).catch((error) => {
    emailReady = null;
    throw error;
  });
  return emailReady;
}

let deskReady: Promise<void> | null = null;
export function ensureDeskSchema(): Promise<void> {
  deskReady ??= retryBusy(async () => { await db().batch([
    { sql: `CREATE TABLE IF NOT EXISTS desk_items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('task','note')),
 title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', due TEXT, done INTEGER NOT NULL DEFAULT 0,
 pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)` },
    { sql: `CREATE INDEX IF NOT EXISTS desk_items_owner ON desk_items(user_id,kind,done)` },
    { sql: `CREATE TABLE IF NOT EXISTS email_references (
 message_key TEXT PRIMARY KEY, folder TEXT NOT NULL, uid INTEGER NOT NULL, subject TEXT NOT NULL,
 sender TEXT NOT NULL, message_id TEXT
)` },
  ], "write"); }).catch(error => { deskReady = null; throw error; });
  return deskReady;
}

let auditReady: Promise<void> | null = null;
/** Admin audit log (see db/009_audit_backup.sql). */
export function ensureAuditSchema(): Promise<void> {
  auditReady ??= retryBusy(async () => { await db().batch([
    { sql: `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT, user_name TEXT, user_email TEXT,
      action TEXT NOT NULL, target_type TEXT, target_id TEXT, details TEXT,
      ip TEXT, user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )` },
    { sql: "CREATE INDEX IF NOT EXISTS audit_log_created ON audit_log (created_at)" },
    { sql: "CREATE INDEX IF NOT EXISTS audit_log_user ON audit_log (user_id, created_at)" },
  ], "write"); }).catch((error) => { auditReady = null; throw error; });
  return auditReady;
}

let twoFactorReady: Promise<void> | null = null;
/** Optional TOTP 2FA per admin user (see db/010_two_factor.sql). */
export function ensureTwoFactorSchema(): Promise<void> {
  twoFactorReady ??= retryBusy(async () => { await ensureTeamSchema(); await db().batch([
    { sql: `CREATE TABLE IF NOT EXISTS admin_2fa (
      user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
      secret_enc TEXT, pending_enc TEXT, pending_at INTEGER,
      last_step INTEGER NOT NULL DEFAULT 0, enabled_at TEXT
    )` },
    { sql: `CREATE TABLE IF NOT EXISTS admin_2fa_recovery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL, used_at TEXT
    )` },
    { sql: "CREATE INDEX IF NOT EXISTS admin_2fa_recovery_user ON admin_2fa_recovery (user_id)" },
  ], "write"); }).catch((error) => { twoFactorReady = null; throw error; });
  return twoFactorReady;
}

/**
 * Multi-role migration, idempotent: every account without rows in admin_user_roles gets the role(s) matching its
 * legacy role/area (founder stays founder; a member gets the role that opens the same sections as their old area).
 * Also run after the founder seed. Existing rows are never touched.
 */
export async function backfillRoles(): Promise<void> {
  const cases = Object.entries(LEGACY_AREA_ROLE).map(([a, r]) => `WHEN u.area = '${a}' THEN '${r}'`).join(" ");
  await db().execute(`INSERT OR IGNORE INTO admin_user_roles (user_id, role)
    SELECT u.id, CASE WHEN u.role = 'founder' THEN 'founder' ${cases} ELSE 'esterno' END FROM admin_users u
    WHERE NOT EXISTS (SELECT 1 FROM admin_user_roles r WHERE r.user_id = u.id)`);
}

let crmReady: Promise<void> | null = null;
/** CRM tables (mirrors db/012_crm.sql, inline so the serverless bundle needs no file reads). Idempotent, once per instance. */
export function ensureCrmSchema(): Promise<void> {
  crmReady ??= retryBusy(async () => {
    // Contacts are read joined to admin_users (owner name and whether they are still on the team).
    await ensureTeamSchema();
    await db().batch(CRM_DDL.map((sql) => ({ sql })), "write");
    // Additive only: optimistic-lock counter for contacts (every write bumps it), then the owner index for "Responsabile" filters.
    await addColumn("crm_contacts", "version", "INTEGER NOT NULL DEFAULT 1");
    await db().execute("CREATE INDEX IF NOT EXISTS crm_contacts_owner ON crm_contacts (archived, owner_user_id)");
    // Additive only: outreach state per contact (last send, unknown outcome, short send lease). See lib/crm-outreach.ts.
    // Rollback: the app ignores it if absent after a code rollback; DROP TABLE crm_outreach removes it with no other effect.
    await db().execute(`CREATE TABLE IF NOT EXISTS crm_outreach (
      contact_id TEXT PRIMARY KEY, last_sent_at TEXT, last_sent_by TEXT, uncertain_at TEXT, uncertain_by TEXT,
      lease_token TEXT, lease_user TEXT, lease_until TEXT
    )`);
    // Additive only: a deal is its own row. Contact stage is not rewritten. Rollback: DROP TABLE crm_opportunities.
    await db().batch(OPPORTUNITY_DDL.map((sql) => ({ sql })), "write");
    // Additive only: an activity is its own row. Follow-ups on the contact are not copied. Rollback: DROP TABLE crm_activities.
    await db().batch(ACTIVITY_DDL.map((sql) => ({ sql })), "write");
    // Additive only: one Oggi snapshot per Rome day. Past cells stay null when they cannot be derived. Rollback: DROP TABLE crm_kpi_daily.
    await db().execute(`CREATE TABLE IF NOT EXISTS crm_kpi_daily (
      day TEXT PRIMARY KEY, contacts_total INTEGER, assigned INTEGER, opportunities_active INTEGER,
      todo_due INTEGER, overdue INTEGER, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
    // Additive only: a founder asks Iris for leads. Rollback: DROP TABLE crm_iris_requests.
    await db().execute(`CREATE TABLE IF NOT EXISTS crm_iris_requests (
      id TEXT PRIMARY KEY, requested_by TEXT NOT NULL, day_rome TEXT NOT NULL, params TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued','working','ready','error')),
      inserted INTEGER, duplicates INTEGER, error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
    await db().execute("CREATE INDEX IF NOT EXISTS crm_iris_requests_day ON crm_iris_requests (requested_by, day_rome)");
    await db().execute("CREATE INDEX IF NOT EXISTS crm_iris_requests_status ON crm_iris_requests (status, created_at)");
    await addColumn("crm_contacts", "iris_request_id", "TEXT");
    await db().execute("CREATE INDEX IF NOT EXISTS crm_contacts_iris_request ON crm_contacts (iris_request_id)");
  }).catch((error) => { crmReady = null; throw error; });
  return crmReady;
}

const CRM_DDL = [
  `CREATE TABLE IF NOT EXISTS crm_contacts (
 id TEXT PRIMARY KEY, business_name TEXT NOT NULL, type TEXT, contact_name TEXT, email TEXT, phone TEXT, website TEXT,
 address TEXT, city TEXT, region TEXT,
 source TEXT NOT NULL DEFAULT 'manuale' CHECK (source IN ('sito','manuale','radar')),
 score INTEGER, score_reasons TEXT,
 stage TEXT NOT NULL DEFAULT 'nuovo' CHECK (stage IN ('nuovo','contattato','call','preventivo','vinto','perso')),
 value_eur REAL, next_action TEXT, next_action_at TEXT, owner_user_id TEXT, notes TEXT, created_by TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 archived INTEGER NOT NULL DEFAULT 0,
 email_norm TEXT NOT NULL DEFAULT '', phone_norm TEXT NOT NULL DEFAULT '', domain TEXT NOT NULL DEFAULT '',
 request_id TEXT, stage_changed_at TEXT
)`,
  "CREATE INDEX IF NOT EXISTS crm_contacts_stage ON crm_contacts (archived, stage)",
  "CREATE INDEX IF NOT EXISTS crm_contacts_email ON crm_contacts (email_norm)",
  "CREATE INDEX IF NOT EXISTS crm_contacts_phone ON crm_contacts (phone_norm)",
  "CREATE INDEX IF NOT EXISTS crm_contacts_domain ON crm_contacts (domain)",
  "CREATE INDEX IF NOT EXISTS crm_contacts_next ON crm_contacts (archived, next_action_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_request ON crm_contacts (request_id) WHERE request_id IS NOT NULL",
  `CREATE TABLE IF NOT EXISTS crm_notes (
 id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, user_id TEXT, body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`,
  "CREATE INDEX IF NOT EXISTS crm_notes_contact ON crm_notes (contact_id, created_at)",
  `CREATE TABLE IF NOT EXISTS crm_drafts (
 id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, subject TEXT NOT NULL, body_html TEXT, body_text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza','inviata','scartata')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), sent_at TEXT, sent_by TEXT
)`,
  "CREATE INDEX IF NOT EXISTS crm_drafts_contact ON crm_drafts (contact_id, created_at)",
];

const ACTIVITY_DDL = [
  `CREATE TABLE IF NOT EXISTS crm_activities (
 id TEXT PRIMARY KEY, contact_id TEXT, opportunity_id TEXT, title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('followup','email','call','meeting','radar','altro')),
 due_date TEXT NOT NULL, due_time TEXT,
 priority TEXT CHECK (priority IN ('alta','media','bassa')),
 assignee_user_id TEXT, done_at TEXT, done_by TEXT,
 version INTEGER NOT NULL DEFAULT 1, idempotency_key TEXT, created_by TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`,
  "CREATE INDEX IF NOT EXISTS crm_activities_assignee ON crm_activities (assignee_user_id, done_at, due_date)",
  "CREATE INDEX IF NOT EXISTS crm_activities_contact ON crm_activities (contact_id, done_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS crm_activities_key ON crm_activities (idempotency_key) WHERE idempotency_key IS NOT NULL",
];

const OPPORTUNITY_DDL = [
  `CREATE TABLE IF NOT EXISTS crm_opportunities (
 id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, title TEXT NOT NULL,
 stage TEXT NOT NULL CHECK (stage IN ('nuovo','contattato','call','preventivo','vinto','perso')),
 value_eur REAL, owner_user_id TEXT,
 source TEXT NOT NULL CHECK (source IN ('sito','manuale','radar')),
 priority TEXT CHECK (priority IN ('alta','media','bassa')),
 opened_at TEXT NOT NULL, closed_at TEXT, version INTEGER NOT NULL DEFAULT 1,
 idempotency_key TEXT, created_by TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`,
  "CREATE INDEX IF NOT EXISTS crm_opportunities_stage ON crm_opportunities (closed_at, stage)",
  "CREATE INDEX IF NOT EXISTS crm_opportunities_owner ON crm_opportunities (owner_user_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS crm_opportunities_one_open ON crm_opportunities (contact_id) WHERE closed_at IS NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS crm_opportunities_key ON crm_opportunities (idempotency_key) WHERE idempotency_key IS NOT NULL",
];

let clientMeetReady: Promise<void> | null = null;
/** Client Meet invites (mirrors db/013_client_meetings.sql). Idempotent, once per instance. */
export function ensureClientMeetSchema(): Promise<void> {
  clientMeetReady ??= retryBusy(async () => {
    await db().batch([
      `CREATE TABLE IF NOT EXISTS client_meetings (
  id TEXT PRIMARY KEY, contact_id TEXT, client_name TEXT NOT NULL, client_email TEXT NOT NULL, title TEXT NOT NULL, agenda TEXT,
  start_local TEXT NOT NULL, minutes INTEGER NOT NULL, meet_url TEXT NOT NULL, event_id TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), cancelled_at TEXT
)`,
      "CREATE INDEX IF NOT EXISTS client_meetings_start ON client_meetings (cancelled_at, start_local)",
      "CREATE INDEX IF NOT EXISTS client_meetings_contact ON client_meetings (contact_id)",
    ].map((sql) => ({ sql })), "write");
  }).catch((error) => { clientMeetReady = null; throw error; });
  return clientMeetReady;
}
