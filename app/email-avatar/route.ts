import sharp from "sharp";
import { db } from "@/lib/db";
import { verifyAvatarSig } from "@/lib/mail/sender";

/** Public, signed sender photo for email signatures (see lib/mail/sender.ts). Always JPEG for client compatibility. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const id = q.get("u") ?? "", v = q.get("v") ?? "", s = q.get("s") ?? "";
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || v.length > 64 || !verifyAvatarSig(id, v, s)) return new Response("Non disponibile", { status: 404 });
  const r = await db().execute({ sql: "SELECT avatar_url FROM admin_users WHERE id = ? AND removed_at IS NULL", args: [id] });
  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(r.rows[0]?.avatar_url ?? ""));
  if (!m) return new Response("Non disponibile", { status: 404 });
  const raw = Buffer.from(m[2], "base64");
  const jpeg = m[1] === "jpeg"
    ? raw
    : await sharp(raw).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex, nofollow" } });
}
