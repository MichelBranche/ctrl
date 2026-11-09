"use server";
import { emailSender } from "@/lib/mail/sender";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { addDraft, addNote, bulkWrite, completeFollowUp, createContact, crmOwners, getContact, getDraft, setArchived, setFollowUp, setKind, setOwner, setStage, updateContact, type ContactInput, type WriteResult } from "@/lib/crm";
import type { ContactKind } from "@/lib/crm-kind";
import { isSource, isStage, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import { CRM_SECTIONS, RUBRICA } from "@/lib/crm-nav";
import { db } from "@/lib/db";
import { mailProvider } from "@/lib/mail";
import { finishSend, logSend, sendAllowed } from "@/lib/mail/collab";
import { ensureCrmSchema } from "@/lib/migrate";
import { beginOutreach, finishOutreach, sendOutcome, UNCERTAIN_MESSAGE } from "@/lib/crm-outreach";
import type { OutreachWarning } from "@/lib/crm-outreach-types";
import { canAccess } from "@/lib/team-types";

export type CrmState = { ok?: string; error?: string; duplicateId?: string; id?: string; warning?: OutreachWarning };

const ID = /^[0-9a-f-]{36}$/i;
const txt = (f: FormData, k: string, max: number) => { const v = String(f.get(k) ?? "").trim().slice(0, max); return v || null; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONFLICT = "Qualcun altro ha modificato il contatto mentre lo guardavi: le tue modifiche non sono state salvate. Ricarico i dati aggiornati.";
/** Version the form was rendered with; null when missing or malformed (the write is then refused, never applied blind). */
const version = (f: FormData) => { const v = Number(f.get("version")); return Number.isInteger(v) && v > 0 ? v : null; };

/** A new responsible person must be an active CRM member; keeping the current one (even a former member) is always allowed. */
async function ownerAllowed(owner: string | null, current: string | null): Promise<boolean> {
  if (!owner || owner === current) return true;
  return (await crmOwners()).some((o) => o.id === owner);
}

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
      const v = version(f);
      if (v === null) return { error: "Modulo non aggiornato: ricarica la pagina e riprova." };
      const before = await getContact(id);
      if (!before) return { error: "Contatto non trovato." };
      if (!(await ownerAllowed(parsed.ownerUserId ?? null, before.ownerUserId))) return { error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
      const r = await updateContact(id, { ...parsed, source: before.source, score: parsed.score ?? before.score, scoreReasons: before.scoreReasons }, v);
      if (r === "notfound") return { error: "Contatto non trovato." };
      if (r === "conflict") { refresh(id); return { error: CONFLICT }; }
      if (typeof r === "object") return { error: "Esiste già un contatto con la stessa email, telefono o sito.", duplicateId: r.duplicate };
      await logAction("crm.contact_update", { type: "crm_contact", id }, before.ownerUserId !== (parsed.ownerUserId ?? null) ? { ownerFrom: before.ownerUserId, ownerTo: parsed.ownerUserId ?? null } : undefined);
      refresh(id);
      return { ok: "Salvato.", id };
    }
    if (!(await ownerAllowed(parsed.ownerUserId ?? null, null))) return { error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
    const r = await createContact({ ...parsed, source: "manuale", ownerUserId: parsed.ownerUserId ?? me.id }, me.id);
    if (r.duplicate) return { error: "Esiste già un contatto con la stessa email, telefono o sito.", duplicateId: r.id };
    await logAction("crm.contact_create", { type: "crm_contact", id: r.id }, { name: parsed.businessName });
    refresh();
    return { ok: "Contatto creato.", id: r.id };
  } catch {
    return { error: "Salvataggio non riuscito. Riprova." };
  }
}

/** Kanban drop (no version: a drag is always on the current card) or a stage form (with the version it was rendered at). */
export async function moveStageAction(id: string, stage: string, expectedVersion?: number): Promise<CrmState> {
  await guardSection("crm");
  if (!ID.test(id) || !isStage(stage)) return { error: "Spostamento non valido." };
  try {
    const r = await setStage(id, stage, expectedVersion);
    if (!r) return { error: "Contatto non trovato." };
    if (r === "conflict") { refresh(id); return { error: CONFLICT }; }
    if (r.from !== stage) await logAction("crm.stage", { type: "crm_contact", id }, { from: r.from, to: stage });
    refresh(id);
    return { ok: `Spostato in ${STAGE_LABEL[stage as Stage]}.` };
  } catch {
    return { error: "Spostamento non riuscito. Riprova." };
  }
}

export async function stageFormAction(f: FormData): Promise<void> {
  await moveStageAction(String(f.get("id") ?? ""), String(f.get("stage") ?? ""), version(f) ?? 0);
}

/** Contact panel: stage select. */
export async function panelStageAction(_: CrmState, f: FormData): Promise<CrmState> {
  const v = version(f);
  if (v === null) return { error: "Modulo non aggiornato: ricarica la pagina." };
  return moveStageAction(String(f.get("id") ?? ""), String(f.get("stage") ?? ""), v);
}

const writeError = (r: WriteResult, id: string): CrmState | null => {
  if (r === "ok") return null;
  refresh(id);
  return { error: r === "conflict" ? CONFLICT : "Contatto non trovato o archiviato." };
};

/** Contact panel: legacy follow-up (text + date). Both empty clears it. */
export async function panelFollowUpAction(_: CrmState, f: FormData): Promise<CrmState> {
  await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const v = version(f);
  if (!ID.test(id) || v === null) return { error: "Modulo non aggiornato: ricarica la pagina." };
  const clear = f.get("clear") === "1";
  const at = clear ? null : txt(f, "next_action_at", 10);
  if (at && !DATE.test(at)) return { error: "Data non valida." };
  const text = clear ? null : txt(f, "next_action", 300) ?? (at ? "Ricontattare" : null);
  try {
    const r = await setFollowUp(id, text, at, v);
    const bad = writeError(r, id);
    if (bad) return bad;
    await logAction("crm.followup_set", { type: "crm_contact", id }, { at });
    refresh(id);
    return { ok: at || text ? "Follow-up salvato." : "Follow-up rimosso." };
  } catch {
    return { error: "Non salvato. Riprova." };
  }
}

/** Contact panel: responsible person. Empty = explicitly nobody. */
export async function panelOwnerAction(_: CrmState, f: FormData): Promise<CrmState> {
  await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const v = version(f);
  if (!ID.test(id) || v === null) return { error: "Modulo non aggiornato: ricarica la pagina." };
  const owner = txt(f, "owner_user_id", 64);
  try {
    const before = await getContact(id);
    if (!before) return { error: "Contatto non trovato." };
    if (owner === before.ownerUserId) return { ok: "Nessuna modifica." };
    if (!(await ownerAllowed(owner, before.ownerUserId))) return { error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
    const bad = writeError(await setOwner(id, owner, v), id);
    if (bad) return bad;
    await logAction("crm.owner", { type: "crm_contact", id }, { from: before.ownerUserId, to: owner });
    refresh(id);
    return { ok: owner ? "Responsabile aggiornato." : "Responsabile rimosso." };
  } catch {
    return { error: "Non salvato. Riprova." };
  }
}

export type BulkItem = { id: string; version: number };
export type BulkChange = { kind: "owner"; owner: string | null } | { kind: "stage"; stage: string } | { kind: "followup"; text: string | null; at: string | null };
export type BulkResult = { ok?: string; error?: string; updated: number; changed: number; missing: number };
const BULK_MAX = 100;

/**
 * Same change on the selected contacts, each one only if unchanged since the list was rendered (version). Partial
 * results are reported, never retried blindly. No email is ever sent from here.
 */
export async function bulkContactsAction(items: BulkItem[], change: BulkChange): Promise<BulkResult> {
  await guardSection("crm");
  const none = { updated: 0, changed: 0, missing: 0 };
  if (!Array.isArray(items) || !items.length) return { ...none, error: "Seleziona almeno un contatto." };
  if (items.length > BULK_MAX) return { ...none, error: `Massimo ${BULK_MAX} contatti alla volta.` };
  if (!items.every((i) => i && typeof i.id === "string" && ID.test(i.id) && Number.isInteger(i.version) && i.version > 0)) return { ...none, error: "Selezione non valida: ricarica la pagina." };
  if (change.kind === "stage" && !isStage(change.stage)) return { ...none, error: "Fase non valida." };
  if (change.kind === "followup" && (change.at !== null && !DATE.test(change.at))) return { ...none, error: "Data non valida." };
  if (change.kind === "owner" && change.owner !== null && !(await crmOwners()).some((o) => o.id === change.owner)) return { ...none, error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  const wrote = await bulkWrite(unique, change.kind === "followup"
    ? { kind: "followup", at: change.at, text: change.text?.trim().slice(0, 300) || (change.at ? "Ricontattare" : null) }
    : change.kind === "stage" ? { kind: "stage", stage: change.stage as Stage } : { kind: "owner", owner: change.owner });
  const out = { updated: wrote.updated, changed: wrote.changed, missing: wrote.missing };
  for (const id of wrote.updatedIds) {
    if (change.kind === "stage") {
      const from = wrote.stageFrom[id];
      if (from && from !== change.stage) await logAction("crm.stage", { type: "crm_contact", id }, { from, to: change.stage, bulk: true });
    } else if (change.kind === "owner") {
      await logAction("crm.owner", { type: "crm_contact", id }, { to: change.owner, bulk: true });
    } else {
      await logAction("crm.followup_set", { type: "crm_contact", id }, { at: change.at, bulk: true });
    }
  }
  refresh();
  const parts = [`${out.updated} aggiornati`];
  if (out.changed) parts.push(`${out.changed} modificati da altri nel frattempo e lasciati com'erano`);
  if (out.missing) parts.push(`${out.missing} non trovati o archiviati`);
  return out.updated ? { ...out, ok: `${parts.join(", ")}.` } : { ...out, error: `Nessun contatto aggiornato: ${parts.slice(1).join(", ") || "nessuna modifica"}.` };
}

/** Stored kind. Null puts the contact back on the deduction (company name, or a person when the names match). */
export async function setKindAction(id: string, kind: string | null, expectedVersion: number): Promise<CrmState> {
  await guardSection("crm");
  if (!ID.test(id) || !Number.isInteger(expectedVersion)) return { error: "Contatto non valido." };
  if (kind !== null && kind !== "" && kind !== "azienda" && kind !== "persona") return { error: "Tipo non valido." };
  const next: ContactKind | null = kind === "azienda" || kind === "persona" ? kind : null;
  try {
    const r = await setKind(id, next, expectedVersion);
    if (r === "notfound") return { error: "Contatto non trovato." };
    if (r === "conflict") { refresh(id); return { error: CONFLICT }; }
    await logAction("crm.contact_update", { type: "crm_contact", id }, { kind: next });
    refresh(id);
    return { ok: next === "persona" ? "Segnato come persona." : next === "azienda" ? "Segnato come azienda." : "Tipo calcolato in automatico." };
  } catch {
    return { error: "Non salvato. Riprova." };
  }
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
export async function sendDraftAction(id: string, ack?: string | null): Promise<CrmState> {
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
  // Same CRM outreach guard as the composer (lib/crm-outreach.ts): lease + consent bound to the contact's current state.
  let gate;
  try { gate = await beginOutreach(me, [contact.email], typeof ack === "string" ? ack.slice(0, 64) : null); }
  catch { return { error: "Controllo del contatto non disponibile: niente è stato inviato. Riprova tra poco." }; }
  if (gate.kind === "warn") return { warning: gate.warning };
  if (gate.kind === "busy") return { error: gate.message };
  const claim = await db().execute({ sql: "UPDATE crm_drafts SET sent_by = ? WHERE id = ? AND status = 'bozza' AND sent_by IS NULL", args: [me.id, id] });
  if (!claim.rowsAffected) { await finishOutreach(gate.lease, "failed").catch(() => {}); return { error: "Invio già in corso." }; }
  const logId = crypto.randomUUID();
  try {
    await logSend({ id: logId, userId: me.id, recipients: [contact.email], subject: draft.subject, inReplyTo: null });
    const { messageId } = await provider.send({ to: [contact.email], cc: [], subject: draft.subject, text: draft.bodyText, sender: emailSender(me) });
    await finishSend(logId, messageId);
  } catch (error) {
    const outcome = sendOutcome(error);
    await finishSend(logId, null).catch(() => {});
    await finishOutreach(gate.lease, outcome).catch(() => {});
    await logAction("crm.draft_send_failed", { type: "crm_draft", id }, { to: contact.email, uncertain: outcome === "uncertain" });
    await db().execute({ sql: "UPDATE crm_drafts SET sent_by = NULL WHERE id = ? AND status = 'bozza'", args: [id] });
    // Unknown outcome: the contact is flagged, so the next attempt (anyone's) needs a new informed "Continua comunque".
    if (outcome === "uncertain") return { error: UNCERTAIN_MESSAGE };
    return { error: "Invio non riuscito, la bozza è ancora disponibile. Riprova tra poco." };
  }
  await finishOutreach(gate.lease, "sent").catch(() => {});
  await db().execute({ sql: "UPDATE crm_drafts SET status = 'inviata', sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [id] });
  await addNote(contact.id, me.id, `Email inviata: ${draft.subject}`);
  await logAction("crm.draft_sent", { type: "crm_draft", id }, { to: contact.email, contact: contact.id });
  refresh(contact.id);
  return { ok: `Inviata a ${contact.email}.` };
}
