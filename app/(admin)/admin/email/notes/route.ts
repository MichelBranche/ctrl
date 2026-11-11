import { getAdmin } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { KEY } from "@/lib/mail/collab";
import { ensureEmailSchema } from "@/lib/migrate";
import { db } from "@/lib/db";
import { avatarFor } from "@/lib/avatars";

export async function GET(request: Request) {
  const me = await getAdmin();
  if (!me || !canAccess(me, "email")) return new Response("Non autorizzato", { status: 401 });
  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "", before = Number(params.get("before") ?? Number.MAX_SAFE_INTEGER);
  if (!KEY.test(key) || !Number.isSafeInteger(before) || before < 1) return new Response("Richiesta non valida", { status: 400 });
  await ensureEmailSchema();
  const result = await db().execute({ sql: `SELECT n.id,n.body,n.created_at,u.id AS user_id,u.name,u.email,u.avatar_url IS NOT NULL AS has_avatar,u.updated_at
    FROM email_notes n LEFT JOIN admin_users u ON u.id=n.user_id WHERE n.message_key=? AND n.id<? ORDER BY n.id DESC LIMIT 51`, args: [key,before] });
  const notes = result.rows.slice(0,50).map(row => ({ id: Number(row.id), body: String(row.body), at: String(row.created_at), name: String(row.name ?? "Utente rimosso"), avatarUrl: row.user_id ? avatarFor(String(row.user_id),Number(row.has_avatar)===1,row.updated_at,String(row.email)) : null }));
  return Response.json({ notes, hasMore: result.rows.length > 50 }, { headers: { "Cache-Control": "private, no-store" } });
}
