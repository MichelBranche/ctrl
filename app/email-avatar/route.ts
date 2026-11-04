import { db } from "@/lib/db";
import { verifyAvatarSig } from "@/lib/mail/sender";

/** Public, signed sender photo for email signatures (see lib/mail/sender.ts). Only the signed id is served. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const id = q.get("u") ?? "", v = q.get("v") ?? "", s = q.get("s") ?? "";
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || v.length > 64 || !verifyAvatarSig(id, v, s)) return new Response("Non disponibile", { status: 404 });
  const r = await db().execute({ sql: "SELECT avatar_url FROM admin_users WHERE id = ? AND removed_at IS NULL", args: [id] });
  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(r.rows[0]?.avatar_url ?? ""));
  if (!m) return new Response("Non disponibile", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), { headers: { "Content-Type": `image/${m[1]}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex, nofollow" } });
}
