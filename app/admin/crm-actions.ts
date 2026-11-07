"use server";
import { emailSender } from "@/lib/mail/sender";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { addDraft, addNote, completeFollowUp, createContact, getContact, getDraft, setArchived, setStage, updateContact, type ContactInput } from "@/lib/crm";
import { isSource, isStage, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import { CRM_SECTIONS, RUBRICA } from "@/lib/crm-nav";
import { db } from "@/lib/db";
import { mailProvider } from "@/lib/mail";
import { finishSend, logSend, sendAllowed } from "@/lib/mail/collab";
import { ensureCrmSchema } from "@/lib/migrate";
import { canAccess } from "@/lib/team-types";

export type CrmState = { ok?: string; error?: string; duplicateId?: string; id?: string };

const ID = /^[0-9a-f-]{36}$/i;
const txt = (f: FormData, k: string, max: number) => { const v = String(f.get(k) ?? "").trim().slice(0, max); return v || null; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "1.500,50" or "1500.5" -> 1500.5; empty -> null; invalid -> NaN. */
function euros(v: string | null): number | null {
  if (!v) return null;
  const clean = v.replace(/[€\s]/g, "");
  const num = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
  return Number.isFinite(num) && num >= 0 && num < 1e9 ? Math.round(num * 100) / 100 : Number.NaN;
}

function refresh(id?: string) {
  for (const s of CRM_SECTIONS) revalidatePath(s.href);
  revalidatePath("/admin/desk");
  if (id) revalidatePath(`/admin/crm/${id}`);
}

function parseContact(f: FormData): ContactInput | string {
  const businessName = txt(f, "business_name", 200);
  if (!businessName) return "Scrivi il nome dell'attività o della persona.";
  const email = txt(f, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Email non valida.";
  const valueEur = euros(txt(f, "value_eur", 20));
  if (Number.isNaN(valueEur)) return "Valore non valido: usa un numero in euro.";
  const nextActionAt = txt(f, "next_action_at", 10);
  if (nextActionAt && !DATE.test(nextActionAt)) return "Data della prossima azione non valida.";
  const scoreRaw = txt(f, "score", 3);
  const score = scoreRaw === null ? null : Number(scoreRaw);
  if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) return "Il punteggio va da 0 a 100.";
  const source = String(f.get("source") ?? "manuale");
  const owner = txt(f, "owner_user_id", 64);
  return {
    businessName, type: txt(f, "type", 80), contactName: txt(f, "contact_name", 120), email, phone: txt(f, "phone", 40), website: txt(f, "website", 300),
    address: txt(f, "address", 300), city: txt(f, "city", 100), region: txt(f, "region", 100), source: isSource(source) ? source : "manuale",
    score, valueEur, nextAction: txt(f, "next_action", 300), nextActionAt, ownerUserId: owner, notes: txt(f, "notes", 5000),
  };
}

export async function saveContactAction(_: CrmState, f: FormData): Promise<CrmState> {
  const me = await guardSection("crm");
  const parsed = parseContact(f);
  if (typeof parsed === "string") return { error: parsed };
  const id = String(f.get("id") ?? "");
  try {
    if (id) {
      if (!ID.test(id)) return { error: "Contatto non valido." };
      const before = await getContact(id);
      if (!before) return { error: "Contatto non trovato." };
      const r = await updateContact(id, { ...parsed, source: before.source, score: parsed.score ?? before.score, scoreReasons: before.scoreReasons });
      if (r === "notfound") return { error: "Contatto non trovato." };
      if (typeof r === "object") return { error: "Esiste già un contatto con la stessa email, telefono o sito.", duplicateId: r.duplicate };
      await logAction("crm.contact_update", { type: "crm_contact", id });
      refresh(id);
      return { ok: "Salvato.", id };
    }
    const r = await createContact({ ...parsed, source: "manuale", ownerUserId: parsed.ownerUserId ?? me.id }, me.id);
    if (r.duplicate) return { error: "Esiste già un contatto con la stessa email, telefono o sito.", duplicateId: r.id };
    await logAction("crm.contact_create", { type: "crm_contact", id: r.id }, { name: parsed.businessName });
    refresh();
    return { ok: "Contatto creato.", id: r.id };
  } catch {
    return { error: "Salvataggio non riuscito. Riprova." };
  }
}

/** Kanban drop: change stage, audit the move. */
export async function moveStageAction(id: string, stage: string): Promise<CrmState> {
  await guardSection("crm");
  if (!ID.test(id) || !isStage(stage)) return { error: "Spostamento non valido." };
  try {
    const r = await setStage(id, stage);
    if (!r) return { error: "Contatto non trovato." };
    if (r.from !== stage) await logAction("crm.stage", { type: "crm_contact", id }, { from: r.from, to: stage });
    refresh(id);
    return { ok: `Spostato in ${STAGE_LABEL[stage as Stage]}.` };
  } catch {
    return { error: "Spostamento non riuscito. Riprova." };
  }
}

export async function stageFormAction(f: FormData): Promise<void> {
  await moveStageAction(String(f.get("id") ?? ""), String(f.get("stage") ?? ""));
}

export async function archiveAction(f: FormData): Promise<void> {
  await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const archived = f.get("archived") !== "0";
  if (!ID.test(id)) return;
  if (await setArchived(id, archived)) await logAction(archived ? "crm.contact_archive" : "crm.contact_restore", { type: "crm_contact", id });
  refresh(id);
  if (archived) redirect(`${RUBRICA}?archiviato=1`);
}

/** "Fatto" on a follow-up: clears the contact's next action (still the only follow-up source) and keeps it as a note. */
export async function completeFollowUpAction(id: string, seenAt: string): Promise<CrmState> {
  const me = await guardSection("crm");
  if (!ID.test(id) || !DATE.test(seenAt.slice(0, 10)) || seenAt.length > 40) return { error: "Follow-up non valido." };
  try {
    const r = await completeFollowUp(id, seenAt, me.id);
    if (r === "changed") { refresh(id); return { error: "Il follow-up è stato modificato da qualcun altro: ricarico la lista." }; }
    await logAction("crm.followup_done", { type: "crm_contact", id });
    refresh(id);
    return { ok: "Follow-up completato." };
  } catch {
    return { error: "Non riuscito. Riprova." };
  }
}

export async function addNoteAction(_: CrmState, f: FormData): Promise<CrmState> {
  const me = await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const body = String(f.get("body") ?? "").trim().slice(0, 5000);
  if (!ID.test(id)) return { error: "Contatto non valido." };
  if (body.length < 2) return { error: "Scrivi la nota." };
  try {
    if (!(await getContact(id))) return { error: "Contatto non trovato." };
    await addNote(id, me.id, body);
    await logAction("crm.note", { type: "crm_contact", id });
    refresh(id);
    return { ok: "Nota aggiunta." };
  } catch {
    return { error: "Nota non salvata. Riprova." };
  }
}

/** Edit a draft still in 'bozza', or create one for a contact (draft id empty). */
export async function saveDraftAction(_: CrmState, f: FormData): Promise<CrmState> {
  await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const contactId = String(f.get("contact_id") ?? "");
  const subject = String(f.get("subject") ?? "").trim().slice(0, 300);
  const bodyText = String(f.get("body_text") ?? "").trim().slice(0, 20_000);
  if (!subject || bodyText.length < 5) return { error: "Oggetto e testo sono obbligatori." };
  try {
    await ensureCrmSchema();
    if (id) {
      if (!ID.test(id)) return { error: "Bozza non valida." };
      // Edited text replaces the HTML from the assistant: the branded template renders the text.
      const r = await db().execute({ sql: "UPDATE crm_drafts SET subject = ?, body_text = ?, body_html = NULL WHERE id = ? AND status = 'bozza'", args: [subject, bodyText, id] });
      if (!r.rowsAffected) return { error: "Bozza non modificabile: è già stata inviata o scartata." };
    } else {
      if (!ID.test(contactId) || !(await getContact(contactId))) return { error: "Contatto non valido." };
      await addDraft(contactId, { subject, bodyText });
    }
    refresh(contactId || undefined);
    return { ok: "Bozza salvata." };
  } catch {
    return { error: "Bozza non salvata. Riprova." };
  }
}

export async function discardDraftAction(id: string): Promise<CrmState> {
  await guardSection("crm");
  if (!ID.test(id)) return { error: "Bozza non valida." };
  await ensureCrmSchema();
  const r = await db().execute({ sql: "UPDATE crm_drafts SET status = 'scartata' WHERE id = ? AND status = 'bozza' AND sent_by IS NULL", args: [id] });
  if (!r.rowsAffected) return { error: "Bozza non disponibile." };
  await logAction("crm.draft_discard", { type: "crm_draft", id });
  refresh();
  return { ok: "Bozza scartata." };
}

/**
 * Sends a draft only on explicit click, through the agency send path (MAIL_FROM via Resend SMTP, Gmail fallback, copy in Inviati).
 * Same rules as the inbox: the shared mailbox permission and the per-person/team send limits.
 * The draft is claimed first (sent_by) so a double click cannot send twice.
 */
export async function sendDraftAction(id: string): Promise<CrmState> {
  const me = await guardSection("crm");
  if (!canAccess(me, "email")) return { error: "Per inviare serve l'accesso alla casella Email dell'agenzia. Chiedilo al founder." };
  if (!ID.test(id)) return { error: "Bozza non valida." };
  const limited = await sendAllowed(me.id);
  if (limited) return { error: limited };
  const draft = await getDraft(id);
  if (!draft || draft.status !== "bozza") return { error: "Bozza già inviata o scartata." };
  const contact = await getContact(draft.contactId);
  if (!contact?.email) return { error: "Il contatto non ha un indirizzo email." };
  const provider = mailProvider();
  if (!provider) return { error: "Email dell'agenzia non collegata." };
  const claim = await db().execute({ sql: "UPDATE crm_drafts SET sent_by = ? WHERE id = ? AND status = 'bozza' AND sent_by IS NULL", args: [me.id, id] });
  if (!claim.rowsAffected) return { error: "Invio già in corso." };
  const logId = crypto.randomUUID();
  try {
    await logSend({ id: logId, userId: me.id, recipients: [contact.email], subject: draft.subject, inReplyTo: null });
    const { messageId } = await provider.send({ to: [contact.email], cc: [], subject: draft.subject, text: draft.bodyText, sender: emailSender(me) });
    await finishSend(logId, messageId);
  } catch {
    await finishSend(logId, null).catch(() => {});
    await db().execute({ sql: "UPDATE crm_drafts SET sent_by = NULL WHERE id = ? AND status = 'bozza'", args: [id] });
    await logAction("crm.draft_send_failed", { type: "crm_draft", id }, { to: contact.email });
    return { error: "Invio non riuscito, la bozza è ancora disponibile. Riprova tra poco." };
  }
  await db().execute({ sql: "UPDATE crm_drafts SET status = 'inviata', sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [id] });
  await addNote(contact.id, me.id, `Email inviata: ${draft.subject}`);
  if (contact.stage === "nuovo") await setStage(contact.id, "contattato");
  await logAction("crm.draft_sent", { type: "crm_draft", id }, { to: contact.email, contact: contact.id });
  refresh(contact.id);
  return { ok: `Inviata a ${contact.email}.` };
}
