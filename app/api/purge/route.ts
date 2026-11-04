import { createHash, timingSafeEqual } from "node:crypto";
import { dbConfigured } from "@/lib/db";
import { purgeExpired } from "@/lib/request-guard";
import { purgeAudit } from "@/lib/audit";
import { runBackup } from "@/lib/backup";

export const maxDuration = 60;

/**
 * Daily job (the single vercel.json cron, free on Hobby): retention cleanup, audit log older than
 * 12 months, then the encrypted database backup. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set the route refuses to run.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured) return new Response("No database", { status: 503 });
  await purgeExpired();
  await purgeAudit();
  const backup = await runBackup();
  return Response.json({ ok: backup.ok, backup: { ok: backup.ok, bytes: backup.bytes, kept: backup.kept } });
}

/** Constant-time compare (hashing first makes lengths equal), so the secret cannot be guessed byte by byte. */
function sameSecret(a: string, b: string) {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
}
