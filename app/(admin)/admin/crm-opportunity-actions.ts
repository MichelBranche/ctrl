"use server";
import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { crmOwners } from "@/lib/crm";
import { isDealPriority, isStage, STAGE_LABEL, type DealPriority, type Stage } from "@/lib/crm-core";
import { CRM_SECTIONS } from "@/lib/crm-nav";
import { createOpportunity, getOpportunity, moveOpportunity, searchDealContacts, updateOpportunity, type PatchDeal } from "@/lib/crm-opportunity";
import type { CrmState } from "@/app/admin/crm-actions";

const ID = /^[0-9a-f-]{36}$/i;
const KEY = /^[0-9a-z-]{8,64}$/i;

function refresh() {
  for (const s of CRM_SECTIONS) revalidatePath(s.href);
}

function euros(v: unknown): number | null | typeof Number.NaN {
  if (v === null || v === undefined || v === "") return null;
  const clean = String(v).replace(/[€\s]/g, "");
  const num = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
  return Number.isFinite(num) && num >= 0 && num < 1e9 ? Math.round(num * 100) / 100 : Number.NaN;
}

function asText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

async function ownerOk(owner: string | null, current: string | null): Promise<boolean> {
  if (!owner || owner === current) return true;
  return (await crmOwners()).some((o) => o.id === owner);
}

/** Companies to attach a deal to. Names and cities only. */
export async function searchDealContactsAction(q: string): Promise<{ id: string; name: string; city: string | null }[]> {
  await guardSection("crm");
  if (typeof q !== "string") return [];
  return searchDealContacts(q);
}

/** Opens one deal. Does not change the contact, send mail, or copy a score. */
export async function createOpportunityAction(input: unknown): Promise<CrmState> {
  const me = await guardSection("crm");
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Dati non validi." };
  const src = input as Record<string, unknown>;
  const contactId = typeof src.contactId === "string" ? src.contactId : "";
  const title = typeof src.title === "string" ? asText(src.title.trim()) : "";
  const stage = src.stage;
  const priority = src.priority === null || src.priority === "" || src.priority === undefined ? null : src.priority;
  const owner = typeof src.ownerUserId === "string" && src.ownerUserId ? src.ownerUserId : null;
  const key = typeof src.idempotencyKey === "string" ? src.idempotencyKey : null;
  const value = euros(src.valueEur);
  if (!ID.test(contactId)) return { error: "Scegli l'azienda della trattativa." };
  if (title.length < 2) return { error: "Dai un nome alla trattativa (cosa state vendendo)." };
  if (!isStage(stage)) return { error: "Fase non valida." };
  if (priority !== null && !isDealPriority(priority)) return { error: "Priorità non valida." };
  if (Number.isNaN(value)) return { error: "Valore non valido: usa un numero in euro." };
  if (key !== null && !KEY.test(key)) return { error: "Richiesta non valida. Riapri il modulo." };
  if (!(await ownerOk(owner, null))) return { error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
  try {
    const result = await createOpportunity({
      contactId, title, stage, valueEur: value, ownerUserId: owner, priority: priority as DealPriority | null, idempotencyKey: key,
    }, me.id);
    if ("error" in result) {
      if (result.error === "open") return { error: "Questo contatto ha già un'opportunità aperta. Chiudila (vinto o perso) prima di aprirne un'altra." };
      if (result.error === "missing") return { error: "Contatto non trovato o archiviato." };
      return { error: "Controlla i campi e riprova." };
    }
    if (result.created) await logAction("crm.opportunity_create", { type: "crm_contact", id: contactId }, { stage });
    refresh();
    return { ok: result.created ? "Opportunità aperta." : "Opportunità già aperta.", id: result.id };
  } catch {
    return { error: "Non salvata. Riprova: se era già aperta non viene duplicata." };
  }
}

/** Board drop and the phase select. The version is the one the card was drawn with. */
export async function moveOpportunityAction(id: string, stage: string, expectedVersion: number): Promise<CrmState> {
  await guardSection("crm");
  if (!ID.test(id) || !isStage(stage) || !Number.isInteger(expectedVersion) || expectedVersion < 1) return { error: "Spostamento non valido." };
  try {
    const result = await moveOpportunity(id, stage, expectedVersion);
    if (result === "missing") return { error: "Opportunità non trovata." };
    if (result === "conflict") { refresh(); return { error: "Qualcun altro ha aggiornato questa trattativa. Ricarico i dati." }; }
    if (result === "open") return { error: "C'è già un'opportunità aperta per questo contatto: non si può riaprirne un'altra." };
    if (result.from !== stage) {
      const deal = await getOpportunity(id);
      await logAction("crm.opportunity_stage", { type: "crm_contact", id: deal?.contactId }, { from: result.from, to: stage });
    }
    refresh();
    return { ok: `Fase della trattativa: ${STAGE_LABEL[stage as Stage]}. Il contatto non è stato modificato.` };
  } catch {
    return { error: "Spostamento non riuscito. Riprova." };
  }
}

export async function panelDealStageAction(_: CrmState, f: FormData): Promise<CrmState> {
  const version = Number(f.get("version"));
  return moveOpportunityAction(String(f.get("id") ?? ""), String(f.get("stage") ?? ""), version);
}

async function patch(f: FormData, fields: PatchDeal): Promise<CrmState> {
  await guardSection("crm");
  const id = String(f.get("id") ?? "");
  const version = Number(f.get("version"));
  if (!ID.test(id) || !Number.isInteger(version) || version < 1) return { error: "Modulo non aggiornato: ricarica la pagina." };
  const current = await getOpportunity(id);
  if (!current) return { error: "Opportunità non trovata." };
  if (fields.ownerUserId !== undefined && !(await ownerOk(fields.ownerUserId, current.ownerUserId))) {
    return { error: "Il responsabile scelto non è un membro attivo con accesso al CRM." };
  }
  const result = await updateOpportunity(id, fields, version);
  if (result === "conflict") { refresh(); return { error: "Qualcun altro ha aggiornato questa trattativa. Ricarico i dati." }; }
  if (result === "missing") return { error: "Opportunità non trovata." };
  if (result === "invalid") return { error: "Controlla i campi e riprova." };
  await logAction("crm.opportunity_update", { type: "crm_contact", id: current.contactId }, { fields: Object.keys(fields).join(",") });
  refresh();
  return { ok: "Trattativa aggiornata. Il contatto non è stato modificato." };
}

export async function panelDealOwnerAction(_: CrmState, f: FormData): Promise<CrmState> {
  const owner = String(f.get("owner_user_id") ?? "");
  return patch(f, { ownerUserId: owner || null });
}

export async function panelDealPriorityAction(_: CrmState, f: FormData): Promise<CrmState> {
  const priority = String(f.get("priority") ?? "");
  if (!priority) return patch(f, { priority: null });
  if (!isDealPriority(priority)) return { error: "Priorità non valida." };
  return patch(f, { priority });
}

export async function panelDealValueAction(_: CrmState, f: FormData): Promise<CrmState> {
  const title = asText(String(f.get("title") ?? "").trim());
  const value = euros(f.get("value_eur"));
  if (Number.isNaN(value)) return { error: "Valore non valido: usa un numero in euro." };
  return patch(f, { title, valueEur: value });
}
