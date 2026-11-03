"use server";

import { guardSection } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureEmailSchema } from "@/lib/migrate";
import { KEY } from "@/lib/mail/collab";
import { isMailStatus } from "@/lib/mail/workflow-types";

export async function updateMailStatus(key: string, status: string): Promise<{ error?: string }> {
  try {
    const me = await guardSection("email");
    if (!KEY.test(key) || !isMailStatus(status)) return { error: "Stato non valido." };
    await ensureEmailSchema();
    await db().execute({ sql: "INSERT INTO email_workflow(message_key,status,updated_by) VALUES(?,?,?) ON CONFLICT(message_key) DO UPDATE SET status=excluded.status, updated_by=excluded.updated_by, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')", args: [key,status,me.id] });
    return {};
  } catch { return { error: "Stato non salvato. Controlla la connessione e l’accesso alla casella." }; }
}

export async function addInternalNote(key: string, body: string, requestId: string): Promise<{ error?: string }> {
  try {
    const me = await guardSection("email");
    if (!KEY.test(key) || typeof body !== "string" || !body.trim() || body.length > 4000 || !/^[a-f0-9-]{36}$/.test(requestId)) return { error: "Inserisci una nota di massimo 4000 caratteri." };
    await ensureEmailSchema();
    // Retrying the same submission cannot create duplicate notes.
    await db().execute({ sql: "INSERT INTO email_notes(message_key,user_id,body,request_id) VALUES(?,?,?,?) ON CONFLICT(request_id) DO NOTHING", args: [key,me.id,body.trim(),`${me.id}:${key}:${requestId}`] });
    return {};
  } catch { return { error: "Nota non salvata. Il testo è conservato: puoi riprovare." }; }
}
