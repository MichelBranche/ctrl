/*
 * Decrypts a CTRL backup (.json.gz.enc) locally and optionally restores it into a SQLite/libSQL database.
 *
 *   BACKUP_KEY=... node scripts/restore-backup.ts backup.json.gz.enc out.json            # decrypt to JSON
 *   SESSION_SECRET=... node scripts/restore-backup.ts backup.json.gz.enc --db file:restore.db   # rebuild a DB
 *
 * Key: BACKUP_KEY if set, else SESSION_SECRET (the value that was live when the backup was made).
 * The script reads the key from the environment and never prints it. Node 22.18+ runs .ts directly.
 * Restoring into production: restore into a new local file first, check it, then import with the Turso CLI.
 */
import { createDecipheriv, hkdfSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type Dump = {
  version: 1;
  createdAt: string;
  schema: { type: string; name: string; sql: string }[];
  tables: Record<string, { columns: string[]; rows: unknown[][] }>;
};

function decrypt(data: Buffer, secret: string): Dump {
  if (data.length < 52 || data.subarray(0, 8).toString("latin1") !== "CTRLBK1\0") throw new Error("Not a CTRL backup file");
  const salt = data.subarray(8, 24), iv = data.subarray(24, 36), tag = data.subarray(36, 52);
  const key = Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), salt, "ctrl-backup-v1", 32));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(gunzipSync(Buffer.concat([d.update(data.subarray(52)), d.final()])).toString("utf8")) as Dump;
}

const decode = (v: unknown) =>
  v && typeof v === "object" && "$b64" in v ? Buffer.from(String((v as { $b64: string }).$b64), "base64")
  : v && typeof v === "object" && "$bigint" in v ? BigInt(String((v as { $bigint: string }).$bigint))
  : v;

async function main() {
  const [file, target, dbUrl] = process.argv.slice(2);
  const secret = process.env.BACKUP_KEY || process.env.SESSION_SECRET;
  if (!file || !target) {
    console.error("Uso: node scripts/restore-backup.ts <file.json.gz.enc> <out.json | --db file:restore.db>");
    process.exit(2);
  }
  if (!secret || secret.length < 32) {
    console.error("Imposta BACKUP_KEY o SESSION_SECRET nell'ambiente (almeno 32 caratteri).");
    process.exit(2);
  }
  let dump: Dump;
  try {
    dump = decrypt(readFileSync(file), secret);
  } catch {
    console.error("Decifratura non riuscita: chiave sbagliata o file danneggiato.");
    process.exit(1);
  }
  const counts = Object.entries(dump.tables).map(([t, v]) => `${t}: ${v.rows.length}`).join(", ");
  console.log(`Backup del ${dump.createdAt}. Righe per tabella: ${counts}`);
  if (target !== "--db") {
    writeFileSync(target, JSON.stringify(dump, null, 2));
    console.log(`Scritto ${target}`);
    return;
  }
  if (!dbUrl) { console.error("Indica la destinazione, ad esempio --db file:restore.db"); process.exit(2); }
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: dbUrl });
  const tables = dump.schema.filter((s) => s.type === "table");
  const rest = dump.schema.filter((s) => s.type !== "table");
  await client.batch(tables.map((s) => s.sql.replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")), "write");
  for (const [name, t] of Object.entries(dump.tables)) {
    if (!t.rows.length) continue;
    const q = `"${name.replace(/"/g, '""')}"`;
    const cols = t.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
    const sql = `INSERT OR REPLACE INTO ${q} (${cols}) VALUES (${t.columns.map(() => "?").join(", ")})`;
    for (let i = 0; i < t.rows.length; i += 500) {
      await client.batch(t.rows.slice(i, i + 500).map((r) => ({ sql, args: r.map(decode) as never })), "write");
    }
  }
  for (const s of rest) await client.execute(s.sql.replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i, "CREATE $1INDEX IF NOT EXISTS ").replace(/^CREATE TRIGGER (?!IF NOT EXISTS)/i, "CREATE TRIGGER IF NOT EXISTS "));
  console.log(`Ripristinato in ${dbUrl}`);
}

main();
