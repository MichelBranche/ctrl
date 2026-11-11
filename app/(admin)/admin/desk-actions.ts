"use server";
import { guardSection } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureDeskSchema } from "@/lib/migrate";
import { revalidatePath } from "next/cache";
export type DeskResult = { error?: string; ok?: string };
export async function saveDeskItem(_: DeskResult, form: FormData): Promise<DeskResult> {
  try {
    const me = await guardSection("desk");
    const kind = String(form.get("kind") ?? ""), title = String(form.get("title") ?? "").trim(), body = String(form.get("body") ?? "").trim(), due = String(form.get("due") ?? ""), id = String(form.get("id") ?? "");
    if (!["task","note"].includes(kind) || !title || title.length > 180 || body.length > 6000 || id.length > 80) return { error: "Controlla titolo e testo: massimo 180 e 6000 caratteri." };
    if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due)) || new Date(due).toISOString().slice(0,10)!==due)) return { error: "Data non valida." };
    await ensureDeskSchema();
    if (id) {
      const result = await db().execute({ sql: "UPDATE desk_items SET title=?,body=?,due=? WHERE id=? AND user_id=? AND kind=?", args: [title,body,kind==='task' ? due || null : null,id,me.id,kind] });
      if (!result.rowsAffected) return { error: "Elemento non disponibile." };
    } else await db().execute({ sql: "INSERT INTO desk_items(id,user_id,kind,title,body,due) VALUES(?,?,?,?,?,?)", args: [crypto.randomUUID(),me.id,kind,title,body,kind==='task' ? due || null : null] });
    revalidatePath("/admin/desk"); return { ok: "Salvato." };
  } catch { return { error: "Salvataggio non riuscito. Riprova." }; }
}
export async function changeDeskItem(id: string, operation: string): Promise<DeskResult> {
  try {
    const me = await guardSection("desk"); await ensureDeskSchema();
    const queries: Record<string,string> = {
      done: "UPDATE desk_items SET done=1 WHERE id=? AND user_id=? AND kind='task'",
      reopen: "UPDATE desk_items SET done=0 WHERE id=? AND user_id=? AND kind='task'",
      pin: "UPDATE desk_items SET pinned=1 WHERE id=? AND user_id=? AND kind='note'",
      unpin: "UPDATE desk_items SET pinned=0 WHERE id=? AND user_id=? AND kind='note'",
      archive: "UPDATE desk_items SET done=1 WHERE id=? AND user_id=? AND kind='note'",
      restore: "UPDATE desk_items SET done=0 WHERE id=? AND user_id=? AND kind='note'",
    };
    if (!Object.hasOwn(queries,operation) || typeof id !== "string" || id.length > 80) return { error: "Operazione non valida." };
    const result = await db().execute({sql:queries[operation],args:[id,me.id]});
    if(!result.rowsAffected)return {error:"Elemento non disponibile."};
    revalidatePath("/admin/desk"); return {ok:"Aggiornato."};
  } catch {return {error:"Aggiornamento non riuscito. Riprova."};}
}
