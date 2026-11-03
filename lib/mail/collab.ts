import "server-only";
import { avatarFor } from "@/lib/avatars";
import { db } from "@/lib/db";
import { ensureEmailSchema } from "@/lib/migrate";
import type { Collab } from "@/lib/mail/types";

export const KEY = /^[a-f0-9]{32}$/;

/** "Letta da" and "presa in carico da" for a set of messages. Metadata only, keyed by Message-ID hash. */
export async function collabFor(keys: string[]): Promise<Map<string, Collab>> {
  const out = new Map<string, Collab>();
  const valid = [...new Set(keys.filter((k) => KEY.test(k)))];
  if (!valid.length) return out;
  await ensureEmailSchema();
  const marks = valid.map(() => "?").join(",");
  const [reads, claims] = await Promise.all([
    db().execute({
      sql: `SELECT r.message_key, u.id, u.name, u.email, u.avatar_url IS NOT NULL AS has_avatar, u.updated_at FROM email_reads r JOIN admin_users u ON u.id = r.user_id WHERE r.message_key IN (${marks}) ORDER BY r.read_at`,
      args: valid,
    }),
    db().execute({
      sql: `SELECT c.message_key, u.id, u.name, u.email, u.avatar_url IS NOT NULL AS has_avatar, u.updated_at, c.claimed_at FROM email_claims c JOIN admin_users u ON u.id = c.user_id WHERE c.message_key IN (${marks})`,
      args: valid,
    }),
  ]);
  for (const k of valid) out.set(k, { readBy: [], claimedBy: null });
  for (const r of reads.rows) out.get(String(r.message_key))?.readBy.push({ id: String(r.id), name: String(r.name), avatarUrl: avatarFor(String(r.id), Number(r.has_avatar) === 1, r.updated_at, String(r.email)) });
  for (const c of claims.rows) {
    const entry = out.get(String(c.message_key));
    if (entry) entry.claimedBy = { id: String(c.id), name: String(c.name), avatarUrl: avatarFor(String(c.id), Number(c.has_avatar) === 1, c.updated_at, String(c.email)), at: String(c.claimed_at) };
  }
  return out;
}

export async function markReadBy(key: string, userId: string) {
  await ensureEmailSchema();
  await db().execute({ sql: "INSERT OR IGNORE INTO email_reads (message_key, user_id) VALUES (?, ?)", args: [key, userId] });
}

export async function setClaim(key: string, userId: string, claim: boolean) {
  await ensureEmailSchema();
  if (claim) {
    await db().execute({
      sql: "INSERT INTO email_claims (message_key, user_id) VALUES (?, ?) ON CONFLICT(message_key) DO UPDATE SET user_id = excluded.user_id, claimed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
      args: [key, userId],
    });
  } else {
    await db().execute({ sql: "DELETE FROM email_claims WHERE message_key = ? AND user_id = ?", args: [key, userId] });
  }
}

/** Sliding-window send limits per person and for the whole agency mailbox (Gmail caps ~500/day). */
export const SEND_LIMITS = { perUser10Min: 10, perUserDay: 60, totalDay: 200 };

export async function sendAllowed(userId: string): Promise<string | null> {
  await ensureEmailSchema();
  const r = await db().execute({
    sql: `SELECT
      SUM(CASE WHEN user_id = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes') THEN 1 ELSE 0 END) AS u10,
      SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS uday,
      COUNT(*) AS total
      FROM email_send_log WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`,
    args: [userId, userId],
  });
  const row = r.rows[0];
  if (Number(row?.u10 ?? 0) >= SEND_LIMITS.perUser10Min) return "Hai inviato molte email negli ultimi 10 minuti: riprova tra poco.";
  if (Number(row?.uday ?? 0) >= SEND_LIMITS.perUserDay) return "Hai raggiunto il limite giornaliero di invii.";
  if (Number(row?.total ?? 0) >= SEND_LIMITS.totalDay) return "La casella ha raggiunto il limite giornaliero di invii del team.";
  return null;
}

/** Logs an attempt before sending (so failures count toward the limit too), then marks the outcome. */
export async function logSend(entry: { id: string; userId: string; recipients: string[]; subject: string; inReplyTo: string | null }) {
  await ensureEmailSchema();
  await db().execute({
    sql: "INSERT INTO email_send_log (id, user_id, recipients, subject, in_reply_to, ok) VALUES (?, ?, ?, ?, ?, 0)",
    args: [entry.id, entry.userId, entry.recipients.join(", ").slice(0, 1000), entry.subject.slice(0, 300), entry.inReplyTo],
  });
}

export async function finishSend(id: string, messageId: string | null) {
  await db().execute({ sql: "UPDATE email_send_log SET ok = ?, message_id = ? WHERE id = ?", args: [messageId ? 1 : 0, messageId, id] });
}

export type SentLogRow = { id: string; who: string; recipients: string; subject: string; ok: boolean; at: string };

export async function recentSends(limit = 8): Promise<SentLogRow[]> {
  await ensureEmailSchema();
  const r = await db().execute({
    sql: "SELECT l.id, COALESCE(u.name, l.user_id) AS who, l.recipients, l.subject, l.ok, l.created_at FROM email_send_log l LEFT JOIN admin_users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.map((x) => ({ id: String(x.id), who: String(x.who), recipients: String(x.recipients), subject: String(x.subject), ok: Number(x.ok) === 1, at: String(x.created_at) }));
}
