import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { getAdmin } from "@/lib/admin";
import { db, dbConfigured } from "@/lib/db";
import { recordAuditNotice } from "@/lib/discord-notify";
import { ensureAuditSchema } from "@/lib/migrate";

/**
 * Admin audit log. One INSERT per event, written after the response (next/server `after`), never throws.
 * Never pass passwords, tokens, email bodies or customer PII: only ids, statuses and short labels.
 */
export type AuditActor = { id: string; name: string; email: string } | null;
export type AuditTarget = { type: string; id?: string | number | null };

const SECRET_KEY = /pass|token|secret|hash|body|message|cookie/i;

function cleanDetails(details?: Record<string, unknown>): string | null {
  if (!details) return null;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (SECRET_KEY.test(k) || v === undefined) continue;
    safe[k] = typeof v === "string" ? v.slice(0, 200) : typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v).slice(0, 200);
  }
  const json = JSON.stringify(safe);
  return json === "{}" ? null : json.slice(0, 1000);
}

/** Records an admin event. `actor` defaults to the signed-in user (request-cached, no extra DB read). */
export async function logAction(action: string, target?: AuditTarget, details?: Record<string, unknown>, actor?: AuditActor): Promise<void> {
  if (!dbConfigured) return;
  try {
    const [h, me] = await Promise.all([headers(), actor === undefined ? getAdmin().catch(() => null) : Promise.resolve(actor)]);
    const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64) || null;
    const ua = (h.get("user-agent") ?? "").slice(0, 160) || null;
    const args = [
      me?.id ?? null, me?.name?.slice(0, 100) ?? null, me?.email?.slice(0, 200) ?? null,
      action.slice(0, 64), target?.type?.slice(0, 32) ?? null, target?.id == null ? null : String(target.id).slice(0, 120),
      cleanDetails(details), ip, ua,
    ];
    const write = async () => {
      try {
        await ensureAuditSchema();
        const inserted = await db().execute({
          sql: "INSERT INTO audit_log (user_id, user_name, user_email, action, target_type, target_id, details, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
          args,
        });
        const id = Number(inserted.rows[0]?.id);
        if (id) await recordAuditNotice({
          id, action: args[3] as string, label: AUDIT_LABEL[args[3] as string] ?? String(args[3]),
          targetType: (args[4] as string | null) ?? null, targetId: (args[5] as string | null) ?? null,
          actorName: (args[1] as string | null) ?? null, details: (args[6] as string | null) ?? null,
        });
      } catch (error) {
        console.error("[audit] write failed:", error instanceof Error ? error.message : error);
      }
    };
    try { after(write); } catch { await write(); }
  } catch {
    // Auditing must never break the action it records.
  }
}

export const AUDIT_LABEL: Record<string, string> = {
  "auth.login": "Accesso",
  "auth.login_failed": "Accesso fallito",
  "auth.logout": "Uscita",
  "auth.password_change": "Password cambiata",
  "auth.2fa_enabled": "Verifica in due passaggi attivata",
  "auth.2fa_disabled": "Verifica in due passaggi disattivata",
  "auth.2fa_failed": "Codice 2FA errato",
  "auth.2fa_recovery_used": "Codice di recupero usato",
  "auth.2fa_forced_setup": "Verifica in due passaggi obbligatoria completata",
  "team.user_create": "Utente creato",
  "team.user_update": "Utente modificato",
  "team.password_reset": "Password reimpostata",
  "team.leaderboard": "Classifica team",
  "team.invite_sent": "Invito inviato",
  "team.invite_resent": "Invito reinviato",
  "team.invite_revoked": "Invito revocato",
  "team.invite_accepted": "Invito accettato",
  "team.user_removed": "Rimosso dal team",
  "team.user_reactivated": "Riattivato nel team",
  "team.offboarding_email": "Email di cessazione inviata",
  "meet.google_connected": "Google Calendar collegato",
  "meet.google_connect_failed": "Collegamento Google non riuscito",
  "meet.google_disconnected": "Google Calendar scollegato",
  "meet.created": "Riunione creata",
  "meet.quick_call": "Chiamata veloce avviata",
  "meet.cancelled": "Riunione annullata",
  "team.offboarding_email_failed": "Email di cessazione non inviata",
  "introiti.job_add": "Lavoro registrato",
  "introiti.job_delete": "Lavoro eliminato",
  "requests.status": "Stato richiesta",
  "requests.delete": "Richiesta eliminata",
  "newsletter.subscriber": "Iscritto aggiornato",
  "newsletter.subscriber_delete": "Iscritto eliminato",
  "newsletter.export": "Export iscritti",
  "email.claim": "Email presa in carico",
  "email.unclaim": "Email rilasciata",
  "email.status": "Stato email",
  "email.note": "Nota interna",
  "email.send": "Email inviata",
  "journal.post_save": "Articolo salvato",
  "journal.post_delete": "Articolo eliminato",
  "media.delete": "Immagine eliminata",
  "settings.social": "Profili social",
  "settings.profile": "Profilo aggiornato",
  "shop.product_save": "Prodotto salvato",
  "shop.product_delete": "Prodotto eliminato",
  "shop.product_publish": "Pubblicazione prodotto",
  "shop.order_status": "Stato ordine",
  "shop.order_fulfilment": "Spedizione ordine",
  "backup.run": "Backup eseguito",
  "backup.download": "Backup scaricato",
  "crm.contact_create": "Contatto CRM creato",
  "crm.contact_update": "Contatto CRM modificato",
  "crm.contact_archive": "Contatto CRM archiviato",
  "crm.contact_restore": "Contatto CRM ripristinato",
  "crm.stage": "Fase pipeline",
  "crm.note": "Nota CRM",
  "crm.followup_done": "Follow-up CRM completato",
  "crm.followup_set": "Follow-up CRM pianificato",
  "crm.owner": "Responsabile CRM",
  "crm.draft_sent": "Bozza Radar inviata",
  "crm.draft_send_failed": "Invio bozza Radar fallito",
  "crm.draft_discard": "Bozza Radar scartata",
  "crm.ingest": "Contatti Radar importati",
  "crm.import": "Contatti importati da CSV",
  "crm.opportunity_create": "Opportunità aperta",
  "crm.opportunity_stage": "Fase opportunità",
  "crm.opportunity_update": "Opportunità aggiornata",
  "crm.activity_create": "Attività creata",
  "crm.activity_update": "Attività aggiornata",
  "crm.activity_done": "Attività completata",
  "crm.activity_reopen": "Attività riaperta",
  "crm.iris_request": "Richiesta Iris",
};

/** Deletes audit entries older than 12 months (daily cron). */
export async function purgeAudit(now = Date.now()): Promise<void> {
  await ensureAuditSchema();
  await db().execute({ sql: "DELETE FROM audit_log WHERE created_at < ?", args: [new Date(now - 365 * 86_400_000).toISOString()] });
}
