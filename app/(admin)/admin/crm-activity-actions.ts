"use server";
import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { createActivity, getActivity, setActivityDone, updateActivity, type ActivityPatch } from "@/lib/crm-activity";
import { isActivityKind, isDealPriority, type ActivityKind, type DealPriority } from "@/lib/crm-core";
import { crmOwners } from "@/lib/crm";
import { CRM_SECTIONS } from "@/lib/crm-nav";
import { isFounder } from "@/lib/team-types";

const ID = /^[0-9a-f-]{36}$/i;
const KEY = /^[0-9a-z-]{8,64}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  for (const s of CRM_SECTIONS) revalidatePath(s.href);
}

function asText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

async function actor() {
  const me = await guardSection("crm");
  return { me, viewer: { id: me.id, founder: isFounder(me) } };
}

async function assigneeAllowed(assignee: string | null, founder: boolean, self: string): Promise<boolean> {
  if (!founder && assignee !== self) return false;
  if (!assignee) return founder || assignee === self;
  if (assignee === self) return true;
  return (await crmOwners()).some((o) => o.id === assignee);
}

const COPY = {
  invalid: "Controlla titolo, data e orario. L'orario è quello di Roma: un'ora che non esiste (cambio dell'ora) non viene spostata al giorno dopo.",
  forbidden: "Puoi gestire solo le attività assegnate a te.",
  missing: "Attività o contatto non trovato.",
  nomatch: "L'opportunità non appartiene a questo contatto.",
  conflict: "Qualcun altro l'ha appena aggiornata. Ricarica e riprova.",
} as const;

export async function createActivityAction(input: {
  title?: string; kind?: string; dueDate?: string; dueTime?: string; priority?: string | null;
  assigneeUserId?: string | null; contactId?: string | null; opportunityId?: string | null; idempotencyKey?: string;
}): Promise<{ ok: string; id: string } | { error: string }> {
  const { me, viewer } = await actor();
  const title = typeof input.title === "string" ? asText(input.title.trim()) : "";
  const kind = isActivityKind(input.kind) ? input.kind : null;
  const dueDate = typeof input.dueDate === "string" && DAY.test(input.dueDate) ? input.dueDate : "";
  const dueTime = typeof input.dueTime === "string" && input.dueTime ? input.dueTime : null;
  const priority: DealPriority | null = input.priority && isDealPriority(input.priority) ? input.priority : null;
  const assignee = typeof input.assigneeUserId === "string" && input.assigneeUserId ? input.assigneeUserId : null;
  const contactId = typeof input.contactId === "string" && ID.test(input.contactId) ? input.contactId : null;
  const opportunityId = typeof input.opportunityId === "string" && ID.test(input.opportunityId) ? input.opportunityId : null;
  const key = typeof input.idempotencyKey === "string" && KEY.test(input.idempotencyKey) ? input.idempotencyKey : null;
  if (!title || !kind || !dueDate) return { error: COPY.invalid };
  if (!(await assigneeAllowed(assignee, viewer.founder, me.id))) return { error: COPY.forbidden };
  const result = await createActivity({
    title, kind, dueDate, dueTime, priority, assigneeUserId: assignee, contactId, opportunityId, idempotencyKey: key,
  }, viewer);
  if ("error" in result) return { error: COPY[result.error] };
  if (result.created) {
    await logAction("crm.activity_create", { type: "crm_contact", id: contactId }, { kind, deal: Boolean(opportunityId), assigned: Boolean(assignee) });
  }
  refresh();
  return { ok: result.created ? "Attività creata." : "Attività già creata.", id: result.id };
}

export async function updateActivityAction(input: {
  id?: string; version?: number; title?: string; kind?: string; dueDate?: string; dueTime?: string; priority?: string | null;
  assigneeUserId?: string | null; contactId?: string | null; opportunityId?: string | null;
}): Promise<{ ok: string } | { error: string }> {
  const { me, viewer } = await actor();
  if (!input.id || !ID.test(input.id) || typeof input.version !== "number") return { error: COPY.invalid };
  const patch: ActivityPatch = {};
  if (typeof input.title === "string") patch.title = asText(input.title.trim());
  if (isActivityKind(input.kind)) patch.kind = input.kind as ActivityKind;
  if (typeof input.dueDate === "string") patch.dueDate = input.dueDate;
  if (input.dueTime !== undefined) patch.dueTime = input.dueTime ? input.dueTime : null;
  if (input.priority !== undefined) patch.priority = input.priority && isDealPriority(input.priority) ? input.priority : null;
  if (input.assigneeUserId !== undefined) {
    const assignee = input.assigneeUserId || null;
    if (!(await assigneeAllowed(assignee, viewer.founder, me.id))) return { error: COPY.forbidden };
    patch.assigneeUserId = assignee;
  }
  if (input.contactId !== undefined) patch.contactId = input.contactId && ID.test(input.contactId) ? input.contactId : null;
  if (input.opportunityId !== undefined) patch.opportunityId = input.opportunityId && ID.test(input.opportunityId) ? input.opportunityId : null;
  const before = await getActivity(input.id, viewer);
  const result = await updateActivity(input.id, patch, input.version, viewer);
  if (result !== "ok") return { error: COPY[result] };
  await logAction("crm.activity_update", { type: "crm_contact", id: before?.contactId ?? patch.contactId ?? null }, { fields: Object.keys(patch).join(",") });
  refresh();
  return { ok: "Attività aggiornata." };
}

export async function setActivityDoneAction(input: { id?: string; version?: number; done?: boolean }): Promise<{ ok: string } | { error: string }> {
  const { viewer } = await actor();
  if (!input.id || !ID.test(input.id) || typeof input.version !== "number" || typeof input.done !== "boolean") return { error: COPY.invalid };
  const before = await getActivity(input.id, viewer);
  if (!before) return { error: COPY.forbidden };
  const result = await setActivityDone(input.id, input.done, input.version, viewer);
  if (result !== "ok") return { error: COPY[result] };
  await logAction(input.done ? "crm.activity_done" : "crm.activity_reopen", { type: "crm_contact", id: before.contactId }, { kind: before.kind });
  refresh();
  return { ok: input.done ? "Attività completata." : "Attività riaperta." };
}
