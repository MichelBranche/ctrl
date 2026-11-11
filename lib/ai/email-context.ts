import "server-only";
import { clip, composeUserPrompt } from "@/lib/ai/copy";
import { getContact, listDrafts, listNotes } from "@/lib/crm";
import { STAGE_LABEL } from "@/lib/crm-core";
import { dealsForContact } from "@/lib/crm-opportunity";
import { contactEmailFacts, type PromptContact, type PromptNote } from "@/lib/crm-prompt";
import { isAgencyAddress, mailProvider } from "@/lib/mail";
import { contactAddress, mailDirection } from "@/lib/mail/contact";

const ID_RE = /^[0-9a-f-]{36}$/i;

export type EmailDossier = { prompt: string; businessName: string; issues: string[] };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function asContact(c: NonNullable<Awaited<ReturnType<typeof getContact>>>): PromptContact {
  return {
    businessName: c.businessName,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    city: c.city,
    region: c.region,
    score: c.score,
    scoreReasons: c.scoreReasons.slice(0, 4).map((reason) => clip(reason, 140)),
    notes: c.notes ? clip(c.notes, 400) : null,
  };
}

/** Subjects and a short excerpt of mail we already sent. Received mail stays out, and bodies are clipped. */
async function sentMail(address: ReturnType<typeof contactAddress>): Promise<string> {
  if (!address) return "Email già inviate: nessuna, manca un indirizzo.";
  const provider = mailProvider();
  if (!provider) return "Email già inviate: casella non collegata.";
  try {
    const data = await withTimeout(provider.contactMessages(address), 6000);
    const sent = data.list.filter((message) => mailDirection(message.from, isAgencyAddress) === "sent").slice(0, 3);
    if (!sent.length) return "Email già inviate: nessuna.";
    const lines: string[] = [];
    for (const message of sent.slice(0, 2)) {
      let excerpt = "";
      try {
        const opened = await withTimeout(provider.message(message.folder, message.uid), 4000);
        excerpt = clip(opened.open?.text ?? "", 180);
      } catch {
        excerpt = "";
      }
      lines.push(`- ${message.date.slice(0, 10)} · ${clip(message.subject || "(nessun oggetto)", 80)}${excerpt ? ` · ${excerpt}` : ""}`);
    }
    return `Email già inviate:\n${lines.join("\n")}`;
  } catch {
    return "Email già inviate: non disponibili in questo momento.";
  }
}

async function sentDrafts(contactId: string): Promise<string> {
  try {
    const drafts = (await listDrafts([contactId])).filter((draft) => draft.status === "inviata").slice(0, 2);
    if (!drafts.length) return "";
    const lines = drafts.map((draft) => `- ${clip(draft.subject, 80)} · ${clip(draft.bodyText, 160)}`);
    return `Bozze segnate come inviate:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * The same facts as "Copia prompt", plus the pipeline phase and a short record of mail already sent.
 * Nothing here is logged. The string is handed only to the chosen model provider.
 */
export async function buildEmailDossier(contactId: string): Promise<EmailDossier | null> {
  if (!ID_RE.test(contactId)) return null;
  const contact = await getContact(contactId);
  if (!contact) return null;
  const [notes, deals] = await Promise.all([
    listNotes(contactId).catch(() => []),
    dealsForContact(contactId).catch(() => []),
  ]);
  const recent: PromptNote[] = notes.slice(0, 2).map((note) => ({ body: clip(note.body, 240), createdAt: note.createdAt }));
  const facts = contactEmailFacts(asContact(contact), recent);
  const open = deals.filter((deal) => deal.open).slice(0, 3);
  const phase = `Fase del contatto: ${STAGE_LABEL[contact.stage]}`;
  const dealLine = open.length
    ? `Trattative aperte: ${open.map((deal) => `${clip(deal.title, 60)} (${STAGE_LABEL[deal.stage]})`).join("; ")}`
    : "Trattative aperte: nessuna";
  const mailbox = await sentMail(contactAddress(contact.email));
  const drafts = mailbox.startsWith("Email già inviate:\n") ? "" : await sentDrafts(contactId);
  const sent = [mailbox, drafts].filter(Boolean).join("\n");
  const issues = contact.scoreReasons.map((reason) => clip(reason, 120)).filter(Boolean).slice(0, 2);
  return {
    prompt: composeUserPrompt({ facts, phase, deals: dealLine, sent }),
    businessName: contact.businessName,
    issues,
  };
}
