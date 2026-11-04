"use server";

import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { runBackup } from "@/lib/backup";

export type BackupActionState = { ok?: string; error?: string };

/** Founders only ("team" is founder-only in canAccess). */
export async function runBackupNow(): Promise<BackupActionState> {
  const me = await guardSection("team");
  const s = await runBackup(me.name);
  await logAction("backup.run", { type: "backup", id: s.pathname ?? null }, { ok: s.ok, bytes: s.bytes }, me);
  revalidatePath("/admin/status");
  return s.ok ? { ok: "Backup completato." } : { error: `Backup non riuscito: ${s.error ?? "errore"}` };
}
