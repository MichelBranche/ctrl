"use server";

import { emailSender } from "@/lib/mail/sender";
import { guardSection } from "@/lib/admin";
import { KEY, finishSend, logSend, markReadBy, sendAllowed, setClaim } from "@/lib/mail/collab";
import { logAction } from "@/lib/audit";
import { mailProvider } from "@/lib/mail";
import { MailError, type OutgoingFile } from "@/lib/mail/provider";
import { isFolder, type FolderId, type MailMutation } from "@/lib/mail/types";
import { beginOutreach, finishOutreach, sendOutcome, UNCERTAIN_MESSAGE } from "@/lib/crm-outreach";
import type { OutreachWarning } from "@/lib/crm-outreach-types";
import { EMAIL_ADDRESS as EMAIL, parseRecipients as parseList } from "@/lib/mail/recipients";

/* Every action re-checks the session and the "email" permission server-side (guardSection throws otherwise). */

const validRef = (folder: unknown, uid: unknown): { folder: FolderId; uid: number } | null =>
  isFolder(folder) && Number.isInteger(uid) && (uid as number) > 0 ? { folder, uid: uid as number } : null;

/** Called when a message is actually opened (not on prefetch): IMAP \Seen + "letta da". */
export async function markOpened(folder: string, uid: number, key: string): Promise<void> {
  const me = await guardSection("email");
  const ref = validRef(folder, uid);
  if (!ref || !KEY.test(key)) return;
  await Promise.all([
    mailProvider()?.setSeen(ref.folder, ref.uid, true).catch(() => {}),
    markReadBy(key, me.id),
  ]);
}

export async function markUnread(folder: string, uid: number): Promise<{ ok: boolean }> {
  await guardSection("email");
  const ref = validRef(folder, uid);
  const p = mailProvider();
  if (!ref || !p) return { ok: false };
  try {
    await p.setSeen(ref.folder, ref.uid, false);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function toggleClaim(key: string, claim: boolean): Promise<{ ok: boolean }> {
  const me = await guardSection("email");
  if (!KEY.test(key)) return { ok: false };
  await setClaim(key, me.id, claim);
  await logAction(claim ? "email.claim" : "email.unclaim", { type: "email", id: key }, undefined, me);
  return { ok: true };
}

/** `warning`: CRM outreach notice (nothing was sent); resend with its `ack` only after an explicit "Continua comunque". */
export type SendState = { draftUid?: number; ok?: string; error?: string; at?: number; warning?: OutreachWarning; uncertain?: boolean };

/** Per-form idempotency key (the send log id): a resubmitted or replayed form cannot send twice. */
const SEND_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
async function uploadedFiles(form: FormData): Promise<OutgoingFile[]> {
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 10 || files.reduce((size, file) => size + file.size, 0) > MAX_UPLOAD_BYTES) throw new Error("Massimo 10 allegati, 3 MB complessivi.");
  return Promise.all(files.map(async (file) => ({ filename: file.name.replace(/[\r\n]/g, "_"), contentType: file.type || "application/octet-stream", content: Buffer.from(await file.arrayBuffer()) })));
}
const attachmentOrigin = (form: FormData) => form.get("keepOriginal") === "on" ? validRef(form.get("originalFolder"), Number(form.get("originalUid"))) ?? undefined : undefined;

export async function sendMail(_: SendState, form: FormData): Promise<SendState> {
  let me;
  try {
    me = await guardSection("email");
  } catch {
    return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." };
  }
  const p = mailProvider();
  if (!p) return { error: "Casella non collegata." };

  const to = parseList(form.get("to"));
  const cc = parseList(form.get("cc"));
  const subject = String(form.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 250);
  const text = String(form.get("body") ?? "").replace(/\r\n/g, "\n");
  if (!to.length) return { error: "Indica almeno un destinatario." };
  const bad = [...to, ...cc].find((a) => !EMAIL.test(a) || a.length > 254);
  if (bad) return { error: `Indirizzo non valido: ${bad.slice(0, 80)}` };
  if (to.length + cc.length > 20) return { error: "Massimo 20 destinatari." };
  if (!subject) return { error: "Manca l'oggetto." };
  if (!text.trim()) return { error: "Il messaggio è vuoto." };
  if (text.length > 50_000) return { error: "Messaggio troppo lungo." };

  const limited = await sendAllowed(me.id);
  if (limited) return { error: limited };

  let inReplyTo: string | null = null;
  let references: string[] = [];
  const reply = validRef(form.get("replyFolder"), Number(form.get("replyUid")));
  if (reply) {
    try {
      const ctx = await p.replyContext(reply.folder, reply.uid);
      if (ctx?.messageId) {
        inReplyTo = ctx.messageId;
        references = [...ctx.references, ctx.messageId].slice(-20);
      }
    } catch {
      // Threading headers are best effort; the reply still goes out.
    }
  }

  let attachments: OutgoingFile[];
  try { attachments = await uploadedFiles(form); }
  catch (error) { return { error: (error as Error).message }; }
  const key = String(form.get("sendKey") ?? "");
  const id = SEND_KEY.test(key) ? key.toLowerCase() : crypto.randomUUID();
  const ack = String(form.get("crmAck") ?? "").slice(0, 64) || null;

  // CRM contacts among the recipients: atomic lease + consent bound to their current state, re-checked right now.
  let gate;
  try { gate = await beginOutreach(me, [...to, ...cc], ack); }
  catch { return { error: "Controllo dei contatti CRM non disponibile: niente è stato inviato. Riprova tra poco.", at: Date.now() }; }
  if (gate.kind === "warn") return { warning: gate.warning, at: Date.now() };
  if (gate.kind === "busy") return { error: gate.message, at: Date.now() };
  const lease = gate.lease;

  try {
    await logSend({ id, userId: me.id, recipients: [...to, ...cc], subject, inReplyTo });
  } catch (error) {
    await finishOutreach(lease, "failed").catch(() => {});
    const duplicate = /UNIQUE|PRIMARY KEY/i.test(String((error as Error)?.message ?? ""));
    return { error: duplicate ? "Questa email risulta già inviata o in invio: controlla in Posta › Inviati." : "Invio non riuscito, riprova tra poco.", at: Date.now() };
  }
  let messageId: string;
  try {
    ({ messageId } = await p.send({ to, cc, subject, text, inReplyTo, references, attachments, attachmentsFrom: attachmentOrigin(form), sender: emailSender(me) }));
  } catch (error) {
    const outcome = sendOutcome(error);
    await finishSend(id, null).catch(() => {});
    await finishOutreach(lease, outcome).catch(() => {});
    if (outcome === "uncertain") return { error: UNCERTAIN_MESSAGE, uncertain: true, at: Date.now() };
    return { error: error instanceof MailError ? error.message : "Invio non riuscito, riprova tra poco.", at: Date.now() };
  }
  await finishSend(id, messageId);
  const { assigned } = await finishOutreach(lease, "sent").catch(() => ({ assigned: [] as string[] }));
  await logAction("email.send", { type: "email_send", id }, { recipients: to.length + cc.length, reply: Boolean(inReplyTo), attachments: attachments.length, crmAssigned: assigned.length }, me);
  const draftUid = Number(form.get("draftUid"));
  if (Number.isSafeInteger(draftUid) && draftUid > 0) await p.mutate?.("drafts", [draftUid], "trash").catch(() => {});
  return { ok: `Inviata a ${to.join(", ")}.${assigned.length ? ` ${assigned.length === 1 ? "Il contatto ora è seguito" : "I contatti ora sono seguiti"} da te.` : ""}`, at: Date.now() };
}

export async function organizeMail(folder: string, uids: number[], operation: MailMutation, label?: string): Promise<{ error?: string; ok?: boolean }> {
  try { await guardSection("email"); } catch { return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." }; }
  const operations: MailMutation[] = ["archive", "trash", "inbox", "spam", "read", "unread", "star", "unstar", "label", "unlabel"];
  if (!isFolder(folder) || !Array.isArray(uids) || !uids.length || uids.length > 30 || !uids.every((uid) => Number.isSafeInteger(uid) && uid > 0) || !operations.includes(operation)) return { error: "Selezione non valida." };
  const provider = mailProvider();
  if (!provider?.mutate) return { error: "Organizzazione non disponibile in questa casella." };
  try {
    await provider.mutate(folder, [...new Set(uids)], operation, label);
    return { ok: true };
  } catch (error) { return { error: error instanceof MailError ? error.message : "Operazione non riuscita. Riprova." }; }
}

export async function createMailLabel(_: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  try { await guardSection("email"); } catch { return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." }; }
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name) || name.startsWith("\\") || name.startsWith("[")) return { error: "Scegli un nome valido (massimo 100 caratteri)." };
  const provider = mailProvider();
  if (!provider?.createLabel) return { error: "Etichette non disponibili in questa casella." };
  try { await provider.createLabel(name); return { ok: true }; }
  catch { return { error: "Etichetta non creata: il nome potrebbe essere già in uso." }; }
}

export async function saveMailDraft(_: SendState, form: FormData): Promise<SendState> {
  let me;
  try { me = await guardSection("email"); } catch { return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." }; }
  const provider = mailProvider();
  if (!provider?.saveDraft) return { error: "Salvataggio bozze non disponibile." };
  const to = parseList(form.get("to"));
  const cc = parseList(form.get("cc"));
  if ([...to, ...cc].some((address) => !EMAIL.test(address))) return { error: "Controlla gli indirizzi email." };
  const subject = String(form.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 250);
  const text = String(form.get("body") ?? "").replace(/\r\n/g, "\n");
  if (text.length > 50_000 || to.length + cc.length > 20) return { error: "Bozza troppo lunga." };
  const prior = Number(form.get("draftUid"));
  if (!Number.isSafeInteger(prior) || prior < 0) return { error: "Bozza non valida." };
  try {
    const attachments = await uploadedFiles(form);
    const draftUid = await provider.saveDraft({ to, cc, subject, text, attachments, attachmentsFrom: attachmentOrigin(form), sender: emailSender(me) }, prior || undefined);
    return { ok: "Bozza salvata in Gmail.", at: Date.now(), draftUid };
  } catch (error) { return { error: error instanceof MailError ? error.message : "Impossibile salvare la bozza. Riprova." }; }
}
