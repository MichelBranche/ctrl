import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// Salt rotates daily and is derived from SESSION_SECRET, so a hash cannot be linked across days or reversed without the secret.
const fallbackSecret = randomBytes(32).toString("hex");
const daySalt = () =>
  createHmac("sha256", process.env.SESSION_SECRET || fallbackSecret)
    .update(`ip-salt:${new Date().toISOString().slice(0, 10)}`)
    .digest();

/** Salted, daily-rotating hash of the client IP. The raw IP is never stored. */
export async function ipHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(daySalt()).update(ip).digest("base64url").slice(0, 32);
}

/** Fixed-window limiter backed by Turso: one upsert per request. Returns false when the caller is over the limit. */
export async function allow(scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${await ipHash()}`;
  const now = Date.now();
  const res = await db().execute({
    sql: `INSERT INTO rate_limits (key, hits, window_at) VALUES (?1, 1, ?2)
          ON CONFLICT(key) DO UPDATE SET
            hits = CASE WHEN window_at < ?2 - ?3 THEN 1 ELSE hits + 1 END,
            window_at = CASE WHEN window_at < ?2 - ?3 THEN ?2 ELSE window_at END
          RETURNING hits`,
    args: [key, now, windowMs],
  });
  // Occasional sweep so the table never grows past a day of keys.
  // Retention promised in the privacy policy: IP fingerprints 48 h, unsubscribed emails 30 days, contact requests 24 months.
  if (Math.random() < 0.2) await purgeExpired(now);
  // A daily cron (app/api/purge) guarantees the cleanup even without traffic.
  return Number(res.rows[0]?.hits ?? 1) <= limit;
}

/** Deletes data past the retention periods stated on /privacy. Runs opportunistically on public form submissions. */
export async function purgeExpired(now = Date.now()) {
  const iso = (ms: number) => new Date(now - ms).toISOString();
  await db().batch(
    [
      { sql: "DELETE FROM rate_limits WHERE window_at < ?", args: [now - 86_400_000] },
      { sql: "DELETE FROM subscribers WHERE unsubscribed_at IS NOT NULL AND unsubscribed_at < ?", args: [iso(30 * 86_400_000)] },
      { sql: "DELETE FROM contact_requests WHERE updated_at < ?", args: [iso(730 * 86_400_000)] },
    ],
    "write",
  );
}
