import { getSiteTeamPhoto } from "@/lib/site-team";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,80}$/;

/**
 * Public portrait for a team member, stored on Turso after an admin upload.
 * Versioned with ?v= so a new photo busts caches immediately.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return new Response("Non disponibile", { status: 404 });
  const photo = await getSiteTeamPhoto(id);
  if (!photo) return new Response("Non disponibile", { status: 404 });

  const etag = `"${photo.updatedAt || "1"}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders(etag, photo.mime) });
  }
  return new Response(Buffer.from(photo.bytes), { status: 200, headers: cacheHeaders(etag, photo.mime) });
}

function cacheHeaders(etag: string, mime: string): HeadersInit {
  return {
    "Content-Type": mime,
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
