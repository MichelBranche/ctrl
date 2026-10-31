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
