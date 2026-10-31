// Applies db/*.sql to the Turso database. Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is missing");
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const dir = new URL("../db/", import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.executeMultiple(readFileSync(new URL(file, dir), "utf8"));
  console.log(`applied ${file}`);
}
db.close();
