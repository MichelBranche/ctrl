// Local test: builds a SQLite file, dumps + encrypts it with lib/backup-core.ts, then restores with
// scripts/restore-backup.ts and compares. Uses a throwaway random key, never a real secret.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { dumpDatabase, encryptBackup, decryptBackup } from "../lib/backup-core.ts";

const dir = mkdtempSync(join(tmpdir(), "ctrl-bk-"));
const key = randomBytes(32).toString("hex");
const src = createClient({ url: `file:${join(dir, "src.db")}` });
await src.batch([
  "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)",
  "CREATE TABLE files (id INTEGER PRIMARY KEY, data BLOB, n INTEGER)",
  "CREATE INDEX files_n ON files (n)",
  "INSERT INTO settings VALUES ('a','uno'),('b','due ✓')",
  "INSERT INTO files (data, n) VALUES (x'00ff10', 42)",
], "write");
const dump = await dumpDatabase(src);
const { data, rawBytes } = encryptBackup(dump, key);
console.log(`dump ${rawBytes} B, cifrato ${data.length} B`);
let wrong = false;
try { decryptBackup(data, randomBytes(32).toString("hex")); } catch { wrong = true; }
if (!wrong) throw new Error("wrong key decrypted!");
const enc = join(dir, "b.json.gz.enc");
writeFileSync(enc, data);
const out = execFileSync("node", ["scripts/restore-backup.ts", enc, "--db", `file:${join(dir, "dst.db")}`], { env: { ...process.env, BACKUP_KEY: key, SESSION_SECRET: "" }, encoding: "utf8" });
if (out.includes(key)) throw new Error("key printed");
const dst = createClient({ url: `file:${join(dir, "dst.db")}` });
const a = JSON.stringify((await dumpDatabase(dst)).tables), b = JSON.stringify(dump.tables);
if (a !== b) throw new Error("mismatch");
console.log("roundtrip OK, chiave errata rifiutata, chiave mai stampata");
