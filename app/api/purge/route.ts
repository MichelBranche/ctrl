import { createHash, timingSafeEqual } from "node:crypto";
import { dbConfigured } from "@/lib/db";
import { purgeExpired } from "@/lib/request-guard";

/**
 * Daily retention cleanup (vercel.json cron, free on Hobby). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set the route refuses to run.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured) return new Response("No database", { status: 503 });
  await purgeExpired();
  return Response.json({ ok: true });
}

/** Constant-time compare (hashing first makes lengths equal), so the secret cannot be guessed byte by byte. */
function sameSecret(a: string, b: string) {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
}
