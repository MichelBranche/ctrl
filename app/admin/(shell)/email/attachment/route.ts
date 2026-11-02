import { getAdmin } from "@/lib/admin";
import { mailProvider } from "@/lib/mail";
import { isFolder } from "@/lib/mail/types";
import { canAccess } from "@/lib/team-types";

const SAFE_INLINE = /^image\/(png|jpe?g|gif|webp)$/i;

/**
 * Downloads one attachment (?f=folder&m=uid&i=index) or serves an inline cid image (&cid=...).
 * Permission-checked; everything except plain images is forced to download, with nosniff and a sandbox CSP.
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "email")) return new Response("Non autorizzato", { status: 401 });
  const p = mailProvider();
  if (!p) return new Response("Casella non collegata", { status: 503 });
  const q = new URL(req.url).searchParams;
  const folder = q.get("f");
  const uid = Number(q.get("m"));
  const cid = q.get("cid");
  const index = Number(q.get("i"));
  if (!isFolder(folder) || !Number.isInteger(uid) || uid <= 0 || (cid === null && (!Number.isInteger(index) || index < 0)) || (cid && cid.length > 300)) {
    return new Response("Richiesta non valida", { status: 400 });
  }
  const file = await p.attachment(folder, uid, cid ? { cid } : { index }).catch(() => null);
  if (!file) return new Response("Allegato non trovato", { status: 404 });
  const inline = Boolean(cid) && SAFE_INLINE.test(file.contentType);
  const name = file.filename.replace(/[\r\n"\\]/g, "_");
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": inline ? file.contentType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
