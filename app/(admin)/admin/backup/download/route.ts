import { getAdmin } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { BACKUP_PATH, readBackup } from "@/lib/backup";
import { canAccess } from "@/lib/team-types";

/** Founder-only: decrypts a stored backup server-side and returns it as gzipped JSON. Never cached. */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "team")) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const p = new URL(req.url).searchParams.get("p") ?? "";
  if (!BACKUP_PATH.test(p)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  let body: Buffer | null = null;
  try { body = await readBackup(p); } catch { body = null; }
  if (!body) return new Response("Backup non disponibile", { status: 404, headers: { "Cache-Control": "no-store" } });
  await logAction("backup.download", { type: "backup", id: p }, undefined, admin);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="ctrl-backup-${p.slice(8, 18)}.json.gz"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
