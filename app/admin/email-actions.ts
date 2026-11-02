"use server";

import { guardSection } from "@/lib/admin";
import { KEY, finishSend, logSend, markReadBy, sendAllowed, setClaim } from "@/lib/mail/collab";
import { mailProvider } from "@/lib/mail";
import { MailError } from "@/lib/mail/provider";
import { isFolder, type FolderId } from "@/lib/mail/types";

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
  return { ok: true };
}

export type SendState = { ok?: string; error?: string; at?: number };

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const parseList = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.match(/<([^>]+)>$/)?.[1]?.trim() ?? s);

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

  const id = crypto.randomUUID();
  await logSend({ id, userId: me.id, recipients: [...to, ...cc], subject, inReplyTo });
  try {
    const { messageId } = await p.send({ to, cc, subject, text, inReplyTo, references });
    await finishSend(id, messageId);
    return { ok: `Inviata a ${to.join(", ")}.`, at: Date.now() };
  } catch (error) {
    await finishSend(id, null).catch(() => {});
    return { error: error instanceof MailError ? error.message : "Invio non riuscito, riprova tra poco." };
  }
}
