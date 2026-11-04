import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Client, InValue } from "@libsql/client";

/*
 * Backup format (v1): MAGIC(8) | salt(16) | iv(12) | tag(16) | AES-256-GCM(gzip(JSON dump)).
 * Key = HKDF-SHA256(BACKUP_KEY || SESSION_SECRET, salt, "ctrl-backup-v1"). Rotating SESSION_SECRET
 * (without setting BACKUP_KEY to the old value) makes older backups undecryptable.
 * scripts/restore-backup.ts mirrors decrypt() so it can run with plain `node`.
 */
const MAGIC = Buffer.from("CTRLBK1\0");
const INFO = "ctrl-backup-v1";
/** Ephemeral tables that are not worth backing up. */
const SKIP = new Set(["rate_limits"]);

export type Dump = {
  version: 1;
  createdAt: string;
  schema: { type: string; name: string; sql: string }[];
  tables: Record<string, { columns: string[]; rows: unknown[][] }>;
};

const encodeValue = (v: unknown): unknown =>
  typeof v === "bigint" ? { $bigint: v.toString() }
  : v instanceof ArrayBuffer ? { $b64: Buffer.from(v).toString("base64") }
  : ArrayBuffer.isView(v) ? { $b64: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") }
  : v;

export const decodeValue = (v: unknown): InValue =>
  v && typeof v === "object" && "$b64" in v ? Buffer.from(String((v as { $b64: string }).$b64), "base64")
  : v && typeof v === "object" && "$bigint" in v ? BigInt(String((v as { $bigint: string }).$bigint))
  : (v as InValue);

/** Reads schema + every row of every user table. One read per 1000 rows. */
export async function dumpDatabase(client: Client): Promise<Dump> {
  const master = await client.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY type = 'table' DESC, name");
  const schema = master.rows.map((r) => ({ type: String(r.type), name: String(r.name), sql: String(r.sql) }));
  const tables: Dump["tables"] = {};
  for (const t of schema) {
    if (t.type !== "table" || SKIP.has(t.name)) continue;
    const q = `"${t.name.replace(/"/g, '""')}"`;
    const out: Dump["tables"][string] = { columns: [], rows: [] };
    for (let offset = 0; ; offset += 1000) {
      const res = await client.execute({ sql: `SELECT * FROM ${q} LIMIT 1000 OFFSET ?`, args: [offset] });
      if (!out.columns.length) out.columns = res.columns;
      for (const row of res.rows) out.rows.push(res.columns.map((_, i) => encodeValue(row[i])));
      if (res.rows.length < 1000) break;
    }
    tables[t.name] = out;
  }
  return { version: 1, createdAt: new Date().toISOString(), schema, tables };
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), salt, INFO, 32));
}

export function encryptBackup(dump: Dump, secret: string): { data: Buffer; rawBytes: number } {
  const json = Buffer.from(JSON.stringify(dump), "utf8");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, salt), iv);
  const ct = Buffer.concat([cipher.update(gzipSync(json, { level: 9 })), cipher.final()]);
  return { data: Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ct]), rawBytes: json.length };
}

export function decryptBackup(data: Buffer, secret: string): Dump {
  if (data.length < 52 || !data.subarray(0, 8).equals(MAGIC)) throw new Error("Not a CTRL backup file");
  const salt = data.subarray(8, 24), iv = data.subarray(24, 36), tag = data.subarray(36, 52);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, salt), iv);
  decipher.setAuthTag(tag);
  const gz = Buffer.concat([decipher.update(data.subarray(52)), decipher.final()]);
  return JSON.parse(gunzipSync(gz).toString("utf8")) as Dump;
}

/** Key material: BACKUP_KEY if set, else SESSION_SECRET. */
export function backupSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.BACKUP_KEY || env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}
