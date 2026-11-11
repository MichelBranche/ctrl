import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  if (!await getAdmin()) return new Response("Non autorizzato", { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return new Response("Richiesta non valida", { status: 400 });
  const result = await db().execute({ sql: "SELECT avatar_url FROM admin_users WHERE id = ?", args: [id] });
  const match = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(result.rows[0]?.avatar_url ?? ""));
  if (!match) return new Response("Foto non disponibile", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(match[2], "base64")), { headers: { "Content-Type": `image/${match[1]}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex, nofollow" } });
}
