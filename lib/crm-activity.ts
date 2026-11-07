import "server-only";
import { db } from "@/lib/db";
import { isActivityKind, isDealPriority, isSource, isStage, type ActivityKind, type DealPriority, type Source, type Stage } from "@/lib/crm-core";
import { romeWall, type ActivityStato, type CrmScope } from "@/lib/crm-nav";
import { ensureClientMeetSchema, ensureCrmSchema } from "@/lib/migrate";

/**
 * CRM activities. Nothing here writes crm_contacts (stage, next_action, owner) or crm_opportunities,
 * and nothing reads desk_items. A follow-up already on a contact stays that follow-up.
 * Visibility is applied in every read: "team" is founder-only. Anyone else gets only rows assigned
 * to them, plus an unassigned row they created themselves. Titles of other people are not returned, counted or searched.
 * A non-founder cannot assign a row to someone else or leave it unassigned.
 */

export type ActivityViewer = { id: string; founder: boolean };

export type Activity = {
  id: string; contactId: string | null; opportunityId: string | null; title: string; kind: ActivityKind;
  dueDate: string; dueTime: string | null; priority: DealPriority | null;
  assigneeUserId: string | null; assigneeName: string | null; doneAt: string | null; version: number;
  contactName: string | null; city: string | null; contactStage: Stage | null; contactSource: Source | null;
  opportunityStage: Stage | null;
};

export type ActivityDraft = {
  title: string; kind: ActivityKind; dueDate: string; dueTime: string | null; priority: DealPriority | null;
  assigneeUserId: string | null; contactId: string | null; opportunityId: string | null; idempotencyKey: string | null;
};

export type ActivityFilter = {
  q?: string; scope?: CrmScope; stato?: ActivityStato; resp?: string; unassigned?: boolean;
  fase?: string; priority?: DealPriority | "nessuna"; giorno?: string; until?: string; contactId?: string;
};

const COLS = `a.id, a.contact_id, a.opportunity_id, a.title, a.kind, a.due_date, a.due_time, a.priority,
  a.assignee_user_id, u.name AS assignee_name, a.done_at, a.version,
  c.business_name, c.city, c.stage AS contact_stage, c.source AS contact_source, o.stage AS opportunity_stage`;
const FROM = `FROM crm_activities a
  LEFT JOIN crm_contacts c ON c.id = a.contact_id
  LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
  LEFT JOIN admin_users u ON u.id = a.assignee_user_id`;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function resolvedScope(viewer: ActivityViewer, scope: CrmScope | undefined): CrmScope {
  return scope === "team" && viewer.founder ? "team" : "mine";
}

function visibility(viewer: ActivityViewer, scope: CrmScope | undefined): { sql: string; args: string[] } {
  if (resolvedScope(viewer, scope) === "team") return { sql: "1 = 1", args: [] };
  return { sql: "(a.assignee_user_id = ? OR (a.assignee_user_id IS NULL AND a.created_by = ?))", args: [viewer.id, viewer.id] };
}

function toActivity(r: Record<string, unknown>): Activity | null {
  if (!isActivityKind(r.kind)) return null;
  const stage = r.contact_stage;
  const source = r.contact_source;
  const deal = r.opportunity_stage;
  return {
    id: String(r.id), contactId: r.contact_id ? String(r.contact_id) : null, opportunityId: r.opportunity_id ? String(r.opportunity_id) : null,
    title: String(r.title), kind: r.kind, dueDate: String(r.due_date), dueTime: r.due_time ? String(r.due_time) : null,
    priority: isDealPriority(r.priority) ? r.priority : null,
    assigneeUserId: r.assignee_user_id ? String(r.assignee_user_id) : null, assigneeName: r.assignee_name ? String(r.assignee_name) : null,
    doneAt: r.done_at ? String(r.done_at) : null, version: Number(r.version),
    contactName: r.business_name ? String(r.business_name) : null, city: r.city ? String(r.city) : null,
    contactStage: isStage(stage) ? stage : null, contactSource: isSource(source) ? source : null,
    opportunityStage: isStage(deal) ? deal : null,
  };
}

const busy = (error: unknown) => /SQLITE_BUSY|database is locked/i.test(String((error as Error)?.message ?? error));
const constraint = (error: unknown) => /SQLITE_CONSTRAINT|UNIQUE constraint/i.test(String((error as Error)?.message ?? error));

async function withWrite<T>(run: () => Promise<T>): Promise<T> {
  await ensureCrmSchema();
  for (let attempt = 1; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (!busy(error) || attempt >= 5) throw error;
      await new Promise((r) => setTimeout(r, 25 * attempt));
    }
  }
}

function where(f: ActivityFilter, viewer: ActivityViewer): { sql: string; args: (string | number)[] } {
  const vis = visibility(viewer, f.scope);
  const parts = [vis.sql];
  const args: (string | number)[] = [...vis.args];
  const stato = f.stato ?? "aperte";
  if (stato === "aperte") parts.push("a.done_at IS NULL");
  else if (stato === "fatte") parts.push("a.done_at IS NOT NULL");
  if (f.q) {
    parts.push("(a.title LIKE ? ESCAPE '\\' OR c.business_name LIKE ? ESCAPE '\\')");
    const like = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    args.push(like, like);
  }
  if (viewer.founder && resolvedScope(viewer, f.scope) === "team") {
    if (f.unassigned) parts.push("a.assignee_user_id IS NULL");
    else if (f.resp) { parts.push("a.assignee_user_id = ?"); args.push(f.resp); }
  }
  if (f.fase && isStage(f.fase)) { parts.push("c.stage = ?"); args.push(f.fase); }
  if (f.priority === "nessuna") parts.push("a.priority IS NULL");
  else if (f.priority) { parts.push("a.priority = ?"); args.push(f.priority); }
  if (f.giorno && DAY.test(f.giorno)) { parts.push("a.due_date = ?"); args.push(f.giorno); }
  if (f.until && DAY.test(f.until)) { parts.push("a.due_date <= ?"); args.push(f.until); }
  if (f.contactId) { parts.push("a.contact_id = ?"); args.push(f.contactId); }
  return { sql: parts.join(" AND "), args };
}

export async function listActivities(f: ActivityFilter, viewer: ActivityViewer): Promise<Activity[]> {
  await ensureCrmSchema();
  const w = where(f, viewer);
  const res = await db().execute({
    sql: `SELECT ${COLS} ${FROM} WHERE ${w.sql} ORDER BY a.due_date, a.due_time IS NULL, a.due_time, a.title LIMIT 200`,
    args: w.args,
  });
  return res.rows.map((r) => toActivity(r as Record<string, unknown>)).filter((a): a is Activity => a !== null);
}

export async function getActivity(id: string, viewer: ActivityViewer): Promise<Activity | null> {
  await ensureCrmSchema();
  const vis = visibility(viewer, "mine");
  const team = viewer.founder ? "" : `AND ${vis.sql}`;
  const res = await db().execute({
    sql: `SELECT ${COLS} ${FROM} WHERE a.id = ? ${team}`,
    args: viewer.founder ? [id] : [id, ...vis.args],
  });
  return res.rows[0] ? toActivity(res.rows[0] as Record<string, unknown>) : null;
}

export type ActivityTotals = { today: number; overdue: number; soon: number; doneMonth: number; prevMonth: number };

function monthBounds(ym: string): { start: string; end: string } | null {
  const [ys, ms] = ym.split("-");
  const y = Number(ys), m = Number(ms);
  if (!y || m < 1 || m > 12) return null;
  const start = romeWall(`${ym}-01`, "00:00");
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = romeWall(`${nextY}-${String(nextM).padStart(2, "0")}-01`, "00:00");
  return start && end ? { start, end } : null;
}

/** Counts inside the caller's visibility. `today` is a Europe/Rome calendar date. No other people's rows are included. */
export async function activityTotals(viewer: ActivityViewer, scope: CrmScope, today: string, month: string): Promise<ActivityTotals> {
  await ensureCrmSchema();
  const vis = visibility(viewer, scope);
  const soon = add7(today);
  const [ys, ms] = month.split("-").map(Number);
  const prevM = ms === 1 ? 12 : ms - 1;
  const prevY = ms === 1 ? ys - 1 : ys;
  const cur = monthBounds(month);
  const prev = monthBounds(`${prevY}-${String(prevM).padStart(2, "0")}`);
  const open = await db().execute({
    sql: `SELECT
      SUM(CASE WHEN a.due_date = ? THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN a.due_date < ? THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN a.due_date > ? AND a.due_date <= ? THEN 1 ELSE 0 END) AS soon
      FROM crm_activities a WHERE a.done_at IS NULL AND ${vis.sql}`,
    args: [today, today, today, soon, ...vis.args],
  });
  const doneIn = async (range: { start: string; end: string } | null) => {
    if (!range) return 0;
    const r = await db().execute({
      sql: `SELECT COUNT(*) AS n FROM crm_activities a WHERE a.done_at >= ? AND a.done_at < ? AND ${vis.sql}`,
      args: [range.start, range.end, ...vis.args],
    });
    return Number(r.rows[0]?.n ?? 0);
  };
  const row = open.rows[0] ?? {};
  return {
    today: Number(row.today ?? 0), overdue: Number(row.overdue ?? 0), soon: Number(row.soon ?? 0),
    doneMonth: await doneIn(cur), prevMonth: await doneIn(prev),
  };
}

function add7(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function weekProgress(viewer: ActivityViewer, scope: CrmScope, start: string, end: string): Promise<{ total: number; done: number }> {
  await ensureCrmSchema();
  const vis = visibility(viewer, scope);
  const r = await db().execute({
    sql: `SELECT COUNT(*) AS total, SUM(CASE WHEN a.done_at IS NOT NULL THEN 1 ELSE 0 END) AS done
      FROM crm_activities a WHERE a.due_date >= ? AND a.due_date <= ? AND ${vis.sql}`,
    args: [start, end, ...vis.args],
  });
  return { total: Number(r.rows[0]?.total ?? 0), done: Number(r.rows[0]?.done ?? 0) };
}

export type MonthMarks = Record<string, { activities: number; meetings: number }>;

/** Days of one month that have a visible activity or a meeting the caller may see. Dates only: no titles, no client names. */
export async function monthMarks(viewer: ActivityViewer, scope: CrmScope, month: string): Promise<MonthMarks> {
  await ensureCrmSchema();
  await ensureClientMeetSchema();
  const vis = visibility(viewer, scope);
  const out: MonthMarks = {};
  const [ys, ms] = month.split("-").map(Number);
  if (!ys || ms < 1 || ms > 12) return out;
  const startDay = `${month}-01`;
  const nextM = ms === 12 ? 1 : ms + 1;
  const nextY = ms === 12 ? ys + 1 : ys;
  const endDay = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const acts = await db().execute({
    sql: `SELECT a.due_date AS day, COUNT(*) AS n FROM crm_activities a WHERE a.due_date >= ? AND a.due_date < ? AND ${vis.sql} GROUP BY a.due_date`,
    args: [startDay, endDay, ...vis.args],
  });
  for (const row of acts.rows) out[String(row.day)] = { activities: Number(row.n), meetings: 0 };
  const meetSql = viewer.founder
    ? "SELECT substr(start_local, 1, 10) AS day, COUNT(*) AS n FROM client_meetings WHERE cancelled_at IS NULL AND start_local >= ? AND start_local < ? GROUP BY 1"
    : "SELECT substr(start_local, 1, 10) AS day, COUNT(*) AS n FROM client_meetings WHERE cancelled_at IS NULL AND start_local >= ? AND start_local < ? AND created_by = ? GROUP BY 1";
  const meets = await db().execute({ sql: meetSql, args: viewer.founder ? [startDay, endDay] : [startDay, endDay, viewer.id] });
  for (const row of meets.rows) {
    const day = String(row.day);
    const cur = out[day] ?? { activities: 0, meetings: 0 };
    cur.meetings = Number(row.n);
    out[day] = cur;
  }
  return out;
}

function assigneeOk(viewer: ActivityViewer, assignee: string | null): boolean {
  if (viewer.founder) return true;
  return assignee === viewer.id;
}

export type ActivityWrite = { id: string; created: boolean } | { error: "invalid" | "forbidden" | "missing" | "nomatch" };

export async function createActivity(draft: ActivityDraft, actor: ActivityViewer): Promise<ActivityWrite> {
  const title = draft.title.trim().slice(0, 200);
  if (!title || !isActivityKind(draft.kind) || !DAY.test(draft.dueDate)) return { error: "invalid" };
  if (draft.dueTime && (!TIME.test(draft.dueTime) || !romeWall(draft.dueDate, draft.dueTime))) return { error: "invalid" };
  if (!assigneeOk(actor, draft.assigneeUserId)) return { error: "forbidden" };
  return withWrite(async () => {
    const tx = await db().transaction("write");
    try {
      if (draft.idempotencyKey) {
        const again = await tx.execute({ sql: "SELECT id FROM crm_activities WHERE idempotency_key = ?", args: [draft.idempotencyKey] });
        if (again.rows[0]) {
          const id = String(again.rows[0].id);
          const vis = visibility(actor, "mine");
          const see = actor.founder
            ? await tx.execute({ sql: "SELECT id FROM crm_activities WHERE id = ?", args: [id] })
            : await tx.execute({ sql: `SELECT id FROM crm_activities a WHERE id = ? AND ${vis.sql}`, args: [id, ...vis.args] });
          return see.rows[0] ? { id, created: false } : { error: "forbidden" as const };
        }
      }
      let contactId = draft.contactId;
      const opportunityId = draft.opportunityId;
      if (opportunityId) {
        const deal = await tx.execute({ sql: "SELECT contact_id FROM crm_opportunities WHERE id = ?", args: [opportunityId] });
        const row = deal.rows[0];
        if (!row) return { error: "missing" };
        if (contactId && contactId !== String(row.contact_id)) return { error: "nomatch" };
        contactId = String(row.contact_id);
      }
      if (contactId) {
        const contact = await tx.execute({ sql: "SELECT id FROM crm_contacts WHERE id = ?", args: [contactId] });
        if (!contact.rows[0]) return { error: "missing" };
      }
      const id = crypto.randomUUID();
      await tx.execute({
        sql: `INSERT INTO crm_activities (id, contact_id, opportunity_id, title, kind, due_date, due_time, priority, assignee_user_id, version, idempotency_key, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [id, contactId, opportunityId, title, draft.kind, draft.dueDate, draft.dueTime, draft.priority, draft.assigneeUserId, draft.idempotencyKey, actor.id],
      });
      await tx.commit();
      return { id, created: true };
    } catch (error) {
      if (constraint(error)) return { error: "invalid" };
      throw error;
    } finally { tx.close(); }
  });
}

export type ActivityPatch = {
  title?: string; kind?: ActivityKind; dueDate?: string; dueTime?: string | null; priority?: DealPriority | null;
  assigneeUserId?: string | null; contactId?: string | null; opportunityId?: string | null;
};

export async function updateActivity(id: string, patch: ActivityPatch, expectedVersion: number, actor: ActivityViewer): Promise<"ok" | "conflict" | "missing" | "invalid" | "forbidden" | "nomatch"> {
  const title = patch.title === undefined ? undefined : patch.title.trim().slice(0, 200);
  if (title !== undefined && !title) return "invalid";
  if (patch.dueDate !== undefined && !DAY.test(patch.dueDate)) return "invalid";
  if (patch.dueTime && !TIME.test(patch.dueTime)) return "invalid";
  if (patch.assigneeUserId !== undefined && !assigneeOk(actor, patch.assigneeUserId)) return "forbidden";
  return withWrite(async () => {
    const tx = await db().transaction("write");
    try {
      const cur = await tx.execute({ sql: "SELECT version, due_date, due_time, contact_id, opportunity_id, assignee_user_id, created_by FROM crm_activities WHERE id = ?", args: [id] });
      const row = cur.rows[0];
      if (!row) return "missing";
      if (!canSee(actor, row)) return "forbidden";
      if (Number(row.version) !== expectedVersion) return "conflict";
      const dueDate = patch.dueDate ?? String(row.due_date);
      const dueTime = patch.dueTime === undefined ? (row.due_time ? String(row.due_time) : null) : patch.dueTime;
      if (dueTime && !romeWall(dueDate, dueTime)) return "invalid";
      let contactId = patch.contactId === undefined ? (row.contact_id ? String(row.contact_id) : null) : patch.contactId;
      const opportunityId = patch.opportunityId === undefined ? (row.opportunity_id ? String(row.opportunity_id) : null) : patch.opportunityId;
      if (opportunityId) {
        const deal = await tx.execute({ sql: "SELECT contact_id FROM crm_opportunities WHERE id = ?", args: [opportunityId] });
        if (!deal.rows[0]) return "missing";
        if (contactId && contactId !== String(deal.rows[0].contact_id)) return "nomatch";
        contactId = String(deal.rows[0].contact_id);
      }
      if (contactId) {
        const contact = await tx.execute({ sql: "SELECT id FROM crm_contacts WHERE id = ?", args: [contactId] });
        if (!contact.rows[0]) return "missing";
      }
      const sets = ["version = version + 1", "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')", "contact_id = ?", "opportunity_id = ?", "due_date = ?", "due_time = ?"];
      const args: (string | null)[] = [contactId, opportunityId, dueDate, dueTime];
      if (title !== undefined) { sets.push("title = ?"); args.push(title); }
      if (patch.kind) { sets.push("kind = ?"); args.push(patch.kind); }
      if (patch.priority !== undefined) { sets.push("priority = ?"); args.push(patch.priority); }
      if (patch.assigneeUserId !== undefined) { sets.push("assignee_user_id = ?"); args.push(patch.assigneeUserId); }
      args.push(id, String(expectedVersion));
      const upd = await tx.execute({ sql: `UPDATE crm_activities SET ${sets.join(", ")} WHERE id = ? AND version = ?`, args });
      if (!upd.rowsAffected) return "conflict";
      await tx.commit();
      return "ok";
    } finally { tx.close(); }
  });
}

function canSee(actor: ActivityViewer, row: Record<string, unknown>): boolean {
  if (actor.founder) return true;
  const assignee = row.assignee_user_id ? String(row.assignee_user_id) : null;
  const created = row.created_by ? String(row.created_by) : null;
  return assignee === actor.id || (assignee === null && created === actor.id);
}

/** Open deals of one contact, so an activity can point at a deal that already exists. Does not create one. */
export async function openDealsForContact(contactId: string): Promise<{ id: string; title: string }[]> {
  await ensureCrmSchema();
  const r = await db().execute({ sql: "SELECT id, title FROM crm_opportunities WHERE contact_id = ? AND closed_at IS NULL ORDER BY opened_at", args: [contactId] });
  return r.rows.map((row) => ({ id: String(row.id), title: String(row.title) }));
}

export async function setActivityDone(id: string, done: boolean, expectedVersion: number, actor: ActivityViewer): Promise<"ok" | "conflict" | "missing" | "forbidden"> {
  return withWrite(async () => {
    const tx = await db().transaction("write");
    try {
      const cur = await tx.execute({ sql: "SELECT version, assignee_user_id, created_by, done_at FROM crm_activities WHERE id = ?", args: [id] });
      const row = cur.rows[0];
      if (!row) return "missing";
      if (!canSee(actor, row)) return "forbidden";
      if (Number(row.version) !== expectedVersion) return "conflict";
      const already = Boolean(row.done_at);
      if (already === done) return "ok";
      const upd = await tx.execute({
        sql: `UPDATE crm_activities SET done_at = ?, done_by = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND version = ?`,
        args: [done ? new Date().toISOString() : null, done ? actor.id : null, id, expectedVersion],
      });
      if (!upd.rowsAffected) return "conflict";
      await tx.commit();
      return "ok";
    } finally { tx.close(); }
  });
}
