import "server-only";
import { db } from "@/lib/db";
import { aiDay } from "@/lib/ai/copy";
import { dailyLimit } from "@/lib/ai/config";
import { ensureAiSchema } from "@/lib/migrate";

export type Slot = { ok: true; remaining: number } | { ok: false; reason: "quota" | "db" };

/**
 * One successful admin AI request counts as one. A provider failure gives the slot back,
 * so an outage does not burn the person's daily cap. The row stores a count, never a prompt.
 */
export async function takeSlot(userId: string, now = new Date()): Promise<Slot> {
  try {
    await ensureAiSchema();
    const day = aiDay(now);
    const limit = dailyLimit();
    const wrote = await db().execute({
      sql: `INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
        ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
        WHERE ai_usage.count < ?`,
      args: [userId, day, limit],
    });
    if (!wrote.rowsAffected) return { ok: false, reason: "quota" };
    const left = await db().execute({ sql: "SELECT count FROM ai_usage WHERE user_id = ? AND day = ?", args: [userId, day] });
    const used = Number(left.rows[0]?.count ?? limit);
    return { ok: true, remaining: Math.max(0, limit - used) };
  } catch {
    return { ok: false, reason: "db" };
  }
}

export async function releaseSlot(userId: string, now = new Date()): Promise<void> {
  try {
    await db().execute({
      sql: "UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0",
      args: [userId, aiDay(now)],
    });
  } catch {
    // The cap may stay one higher until tomorrow. The next take still cannot pass the limit.
  }
}

export async function remainingSlots(userId: string, now = new Date()): Promise<number | null> {
  try {
    await ensureAiSchema();
    const res = await db().execute({
      sql: "SELECT count FROM ai_usage WHERE user_id = ? AND day = ?",
      args: [userId, aiDay(now)],
    });
    const used = Number(res.rows[0]?.count ?? 0);
    return Math.max(0, dailyLimit() - used);
  } catch {
    return null;
  }
}
