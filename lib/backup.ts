import "server-only";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { del, get, list, put } from "@vercel/blob";
import { db, dbConfigured } from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/settings";
import { backupSecret, decryptBackup, dumpDatabase, encryptBackup } from "@/lib/backup-core";

/*
 * Nightly encrypted database backup, run from the existing daily cron (/api/purge).
 * Blob ops per run: 1 put + 1 list + deletes beyond retention. Status lives in `settings`
 * so the admin panel needs no Blob call to show it.
 */
const PREFIX = "backups/";
export const BACKUP_PATH = /^backups\/\d{4}-\d{2}-\d{2}-[a-f0-9]{32}\.json\.gz\.enc$/;
const KEEP = 14;
const KEEP_IF_LARGE = 7;
const LARGE = 25 * 1024 * 1024;
const STATUS_KEY = "backup.last";

export type BackupStatus = { ok: boolean; at: string; bytes?: number; rawBytes?: number; pathname?: string; kept?: number; error?: string; by?: string };

export async function readBackupStatus(): Promise<BackupStatus | null> {
  if (!dbConfigured) return null;
  try {
    const raw = (await readSettings([STATUS_KEY]))[STATUS_KEY];
    return raw ? (JSON.parse(raw) as BackupStatus) : null;
  } catch {
    return null;
  }
}

export async function runBackup(by = "cron"): Promise<BackupStatus> {
  const at = new Date().toISOString();
  let status: BackupStatus;
  try {
    const secret = backupSecret();
    if (!dbConfigured) throw new Error("Database non configurato");
    if (!secret) throw new Error("Chiave di cifratura mancante");
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Storage non configurato");
    const { data, rawBytes } = encryptBackup(await dumpDatabase(db()), secret);
    const pathname = `${PREFIX}${at.slice(0, 10)}-${randomBytes(16).toString("hex")}.json.gz.enc`;
    // Public store, but the file is AES-256-GCM encrypted and the path carries 128 random bits.
    await put(pathname, data, { access: "public", contentType: "application/octet-stream", addRandomSuffix: false, cacheControlMaxAge: 60 });
    const keep = data.length > LARGE ? KEEP_IF_LARGE : KEEP;
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const old = blobs
      .filter((b) => BACKUP_PATH.test(b.pathname))
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
      .slice(keep);
    if (old.length) await del(old.map((b) => b.url));
    status = { ok: true, at, bytes: data.length, rawBytes, pathname, kept: Math.min(keep, blobs.length - old.length), by };
  } catch (error) {
    status = { ok: false, at, error: (error instanceof Error ? error.message : "Errore").slice(0, 200), by };
  }
  try { await writeSettings({ [STATUS_KEY]: JSON.stringify(status) }); } catch { /* status is best effort */ }
  return status;
}

/** Decrypted dump as gzipped JSON (stays under the 4.5 MB function response limit for small DBs) for a stored backup. Caller must be a founder. */
export async function readBackup(pathname: string): Promise<Buffer | null> {
  const secret = backupSecret();
  if (!BACKUP_PATH.test(pathname) || !secret) return null;
  const res = await get(pathname, { access: "public" });
  if (!res || res.statusCode !== 200) return null;
  const data = Buffer.from(await new Response(res.stream).arrayBuffer());
  return gzipSync(JSON.stringify(decryptBackup(data, secret)), { level: 9 });
}
