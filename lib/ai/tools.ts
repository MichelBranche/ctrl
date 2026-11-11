import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { AUDIT_LABEL } from "@/lib/audit";
import { aiDay, classifyAsk, clip, normAsk } from "@/lib/ai/copy";
import { AI_MSG } from "@/lib/ai/messages";
import { dueActions, getContact, listContacts, listNotes, recentCrmEvents, crmOverview } from "@/lib/crm";
import { listActivities } from "@/lib/crm-activity";
import { STAGE_LABEL, STAGES } from "@/lib/crm-core";
import { dealsForContact, opportunityTotals } from "@/lib/crm-opportunity";

export type AiActor = { id: string; founder: boolean; crm: boolean; mail: boolean };

const denied = "Senza accesso al CRM.";

function gate(actor: AiActor): string | null {
  return actor.crm ? null : denied;
}

export async function searchContactsText(actor: AiActor, query: string): Promise<string> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const q = clip(query, 80);
  if (q.length < 2) return "Servono almeno 2 caratteri.";
  try {
    const rows = await listContacts({ q, limit: 6 });
    if (!rows.length) return "Nessun contatto trovato.";
    return rows.map((row) => {
      const place = [row.city, STAGE_LABEL[row.stage]].filter(Boolean).join(", ");
      return `${row.businessName}${row.contactName ? ` (${row.contactName})` : ""} · ${place} · id ${row.id}${row.email ? ` · ${row.email}` : ""}`;
    }).join("\n");
  } catch {
    return "Ricerca contatti non disponibile in questo momento.";
  }
}

export async function contactDetailsText(actor: AiActor, id: string): Promise<string> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return "Id contatto non valido.";
  try {
    const contact = await getContact(id);
    if (!contact) return "Contatto non trovato.";
    const [notes, deals] = await Promise.all([
      listNotes(id).catch(() => []),
      dealsForContact(id).catch(() => []),
    ]);
    const open = deals.filter((deal) => deal.open).slice(0, 3);
    const lines = [
      `${contact.businessName}${contact.contactName ? ` · referente ${contact.contactName}` : ""}`,
      `Fase: ${STAGE_LABEL[contact.stage]}`,
      contact.email ? `Email: ${contact.email}` : "Email: non indicata",
      contact.website ? `Sito: ${contact.website}` : "Sito: non indicato",
      contact.city ? `Città: ${contact.city}` : "",
      contact.score === null ? "Punteggio Iris: non disponibile" : `Punteggio Iris: ${contact.score}`,
      contact.scoreReasons.length ? `Motivi Iris: ${contact.scoreReasons.slice(0, 4).map((reason) => clip(reason, 120)).join("; ")}` : "",
      contact.notes ? `Note: ${clip(contact.notes, 280)}` : "",
      notes[0] ? `Ultima nota: ${clip(notes[0].body, 200)}` : "",
      open.length ? `Trattative aperte: ${open.map((deal) => `${clip(deal.title, 50)} (${STAGE_LABEL[deal.stage]})`).join("; ")}` : "Trattative aperte: nessuna",
      contact.nextAction ? `Prossima azione: ${clip(contact.nextAction, 120)}${contact.nextActionAt ? ` · ${contact.nextActionAt.slice(0, 10)}` : ""}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  } catch {
    return "Scheda non disponibile in questo momento.";
  }
}

export async function pipelineCountsText(actor: AiActor): Promise<string> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  try {
    const [deals, contacts] = await Promise.all([opportunityTotals({}), crmOverview()]);
    const dealLine = STAGES.map((stage) => `${STAGE_LABEL[stage]} ${deals.byStage[stage]}`).join(", ");
    const contactLine = STAGES.map((stage) => `${STAGE_LABEL[stage]} ${contacts.byStage[stage]}`).join(", ");
    return `Trattative per fase: ${dealLine}. Aperte ${deals.open}.\nContatti per fase: ${contactLine}.`;
  } catch {
    return "Conteggi della pipeline non disponibili in questo momento.";
  }
}

export async function recentActivityText(actor: AiActor): Promise<string> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  try {
    const events = await recentCrmEvents(6);
    if (!events.length) return "Nessuna attività recente nel registro.";
    return events.map((event) => {
      const label = AUDIT_LABEL[event.action] ?? "Attività CRM";
      const who = event.contactName ?? "CRM";
      const actorName = event.actor ? ` · ${event.actor}` : "";
      return `${event.at.slice(0, 16)} · ${label} · ${who}${actorName}`;
    }).join("\n");
  } catch {
    return "Attività recenti non disponibili in questo momento.";
  }
}

export async function todaysTasksText(actor: AiActor): Promise<string> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const today = aiDay();
  try {
    const viewer = { id: actor.id, founder: actor.founder };
    const [activities, followUps] = await Promise.all([
      listActivities({ stato: "aperte", until: today, scope: actor.founder ? "team" : "mine" }, viewer),
      dueActions(actor.founder ? null : actor.id, today),
    ]);
    const lines: string[] = [];
    for (const activity of activities.filter((item) => item.dueDate <= today).slice(0, 6)) {
      const who = actor.founder && activity.assigneeName ? ` · ${activity.assigneeName}` : "";
      lines.push(`${activity.dueDate}${activity.dueTime ? ` ${activity.dueTime.slice(0, 5)}` : ""} · ${clip(activity.title, 80)} · ${activity.contactName ?? "senza contatto"}${who}`);
    }
    for (const followUp of followUps.slice(0, 4)) {
      if (lines.length >= 8) break;
      lines.push(`${followUp.nextActionAt.slice(0, 10)} · ${clip(followUp.nextAction ?? "Follow-up", 80)} · ${followUp.businessName}`);
    }
    if (!lines.length) return "Niente in scadenza oggi.";
    return `In scadenza oggi o in ritardo:\n${lines.join("\n")}`;
  } catch {
    return "Attività di oggi non disponibili in questo momento.";
  }
}

/** Compact read-only snapshot used only if Groq fails and Cloudflare answers without tools. */
export async function crmSnapshot(actor: AiActor): Promise<string> {
  const [pipeline, today, recent] = await Promise.all([
    pipelineCountsText(actor),
    todaysTasksText(actor),
    recentActivityText(actor),
  ]);
  return clip(`${pipeline}\n${today}\n${recent}`, 1400);
}

export function crmTools(actor: AiActor): ToolSet {
  return {
    searchContacts: tool({
      description: "Cerca fino a 6 contatti per nome, email, città o sito. Sola lettura.",
      inputSchema: z.object({ query: z.string().min(2).max(80) }),
      execute: async ({ query }) => searchContactsText(actor, query),
    }),
    contactDetails: tool({
      description: "Scheda di un contatto: fase, sito, note brevi, Iris, trattative aperte. Sola lettura. L'id arriva da searchContacts.",
      inputSchema: z.object({ id: z.string().min(8).max(80) }),
      execute: async ({ id }) => contactDetailsText(actor, id),
    }),
    pipelineCounts: tool({
      description: "Quanti contatti e quante trattative ci sono in ogni fase della pipeline. Sola lettura.",
      inputSchema: z.object({}),
      execute: async () => pipelineCountsText(actor),
    }),
    recentActivity: tool({
      description: "Ultime voci del registro CRM: etichetta, contatto, autore, orario. Senza note né testi di email. Sola lettura.",
      inputSchema: z.object({}),
      execute: async () => recentActivityText(actor),
    }),
    todaysTasks: tool({
      description: "Attività e follow-up in scadenza oggi o in ritardo, nel perimetro visibile a questo utente. Sola lettura.",
      inputSchema: z.object({}),
      execute: async () => todaysTasksText(actor),
    }),
  };
}

/** Deterministic CRM answer for AI_MOCK. Same read-only functions, no model call. */
export async function mockCrmAnswer(text: string, actor: AiActor): Promise<string> {
  if (classifyAsk(text) === "offtopic") return AI_MSG.offTopic;
  if (!actor.crm) return AI_MSG.noCrm;
  const n = normAsk(text);
  if (/pipeline|fase|trattativ/.test(n)) return pipelineCountsText(actor);
  if (/oggi|attivit|da fare|scadenz/.test(n)) return todaysTasksText(actor);
  if (/recent|cronolog|ultim|novit|registro/.test(n)) return recentActivityText(actor);
  const query = text.replace(/^(cerca|trova|apri)\s+/i, "").trim();
  if (query.length >= 2) return searchContactsText(actor, query);
  return "Posso cercare un contatto, contare le fasi della pipeline o elencare le attività di oggi.";
}
