import "server-only";
import { db } from "@/lib/db";
import { isClosedStage, isDealPriority, isSource, isStage, type DealPriority, type Source, type Stage } from "@/lib/crm-core";
import { pipelinePeriodStart, type PipelinePeriod } from "@/lib/crm-nav";
import { ensureCrmSchema } from "@/lib/migrate";

/**
 * A deal is not a contact. Nothing here writes crm_contacts.stage, owner, score or notes.
 * One open deal per contact. Won and lost are closed (closed_at set) and do not block a later deal.
 * Rows appear only after createOpportunity: ingest, CSV import, email and Meet never call it.
 */

export type Opportunity = {
  id: string; contactId: string; title: string; stage: Stage; valueEur: number | null;
  ownerUserId: string | null; ownerName: string | null; ownerActive: boolean | null;
  source: Source; priority: DealPriority | null; openedAt: string; closedAt: string | null; version: number;
  contactName: string; city: string | null; contactStage: Stage; score: number | null;
};

export type DealDraft = {
  contactId: string; title: string; stage: Stage; valueEur: number | null; ownerUserId: string | null;
  priority: DealPriority | null; idempotencyKey: string | null;
};

export type DealFilter = {
  q?: string; ownerId?: string; unassigned?: boolean; source?: Source; priority?: DealPriority | "nessuna"; period?: PipelinePeriod;
};

const COLS = `o.id, o.contact_id, o.title, o.stage, o.value_eur, o.owner_user_id, u.name AS owner_name, o.source, o.priority,
  o.opened_at, o.closed_at, o.version, c.business_name, c.city, c.stage AS contact_stage, c.score,
  CASE WHEN o.owner_user_id IS NULL THEN NULL WHEN u.id IS NOT NULL AND u.active = 1 AND u.invite_state IS NULL AND u.removed_at IS NULL THEN 1 ELSE 0 END AS owner_active`;
const FROM = `FROM crm_opportunities o JOIN crm_contacts c ON c.id = o.contact_id LEFT JOIN admin_users u ON u.id = o.owner_user_id`;

function toDeal(r: Record<string, unknown>): Opportunity | null {
  if (!isStage(r.stage) || !isStage(r.contact_stage) || !isSource(r.source)) return null;
  return {
    id: String(r.id), contactId: String(r.contact_id), title: String(r.title), stage: r.stage,
    valueEur: r.value_eur === null || r.value_eur === undefined ? null : Number(r.value_eur),
    ownerUserId: r.owner_user_id ? String(r.owner_user_id) : null, ownerName: r.owner_name ? String(r.owner_name) : null,
    ownerActive: r.owner_active === null || r.owner_active === undefined ? null : Number(r.owner_active) === 1,
    source: r.source, priority: isDealPriority(r.priority) ? r.priority : null,
    openedAt: String(r.opened_at), closedAt: r.closed_at ? String(r.closed_at) : null, version: Number(r.version),
    contactName: String(r.business_name), city: r.city ? String(r.city) : null, contactStage: r.contact_stage,
    score: r.score === null || r.score === undefined ? null : Number(r.score),
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

function where(f: DealFilter, periodStart: string | null): { sql: string; args: (string | number)[] } {
  const parts = ["c.archived = 0"];
  const args: (string | number)[] = [];
  if (periodStart) { parts.push("(o.closed_at IS NULL OR o.closed_at >= ?)"); args.push(periodStart); }
  if (f.q) {
    parts.push("(c.business_name LIKE ? ESCAPE '\\' OR o.title LIKE ? ESCAPE '\\')");
    const like = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    args.push(like, like);
  }
  if (f.unassigned) parts.push("o.owner_user_id IS NULL");
  else if (f.ownerId) { parts.push("o.owner_user_id = ?"); args.push(f.ownerId); }
  if (f.source) { parts.push("o.source = ?"); args.push(f.source); }
  if (f.priority === "nessuna") parts.push("o.priority IS NULL");
  else if (f.priority) { parts.push("o.priority = ?"); args.push(f.priority); }
  return { sql: parts.join(" AND "), args };
}

/** Deals of one contact, open first. Used by the rubrica panel. */
export async function dealsForContact(contactId: string): Promise<{ id: string; title: string; stage: Stage; valueEur: number | null; open: boolean }[]> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `SELECT id, title, stage, value_eur, closed_at FROM crm_opportunities WHERE contact_id = ? ORDER BY closed_at IS NOT NULL, updated_at DESC`,
    args: [contactId],
  });
  return res.rows.flatMap((r) => {
    if (!isStage(r.stage)) return [];
    return [{ id: String(r.id), title: String(r.title), stage: r.stage, valueEur: r.value_eur === null || r.value_eur === undefined ? null : Number(r.value_eur), open: !r.closed_at }];
  });
}

export async function listOpportunities(f: DealFilter = {}): Promise<Opportunity[]> {
  await ensureCrmSchema();
  const start = pipelinePeriodStart(f.period ?? "tutto");
  const w = where(f, start);
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE ${w.sql} ORDER BY o.updated_at DESC, c.business_name`, args: w.args });
  return res.rows.map((r) => toDeal(r as Record<string, unknown>)).filter((d): d is Opportunity => d !== null);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE o.id = ?`, args: [id] });
  return res.rows[0] ? toDeal(res.rows[0] as Record<string, unknown>) : null;
}

export type DealTotals = { open: number; byStage: Record<Stage, number>; won: number; lost: number; wonValue: number; openValue: number };

/** Open counts ignore the period. Won, lost and the rate's inputs are the deals closed inside it. */
export async function opportunityTotals(f: DealFilter = {}): Promise<DealTotals> {
  await ensureCrmSchema();
  const start = pipelinePeriodStart(f.period ?? "tutto");
  const w = where({ ...f, period: "tutto" }, null);
  const closed = start ? `${w.sql} AND o.closed_at >= ?` : w.sql;
  const closedArgs = start ? [...w.args, start] : w.args;
  const [openRows, doneRows] = await Promise.all([
    db().execute({
      sql: `SELECT o.stage AS stage, COUNT(*) AS n, SUM(o.value_eur) AS value FROM crm_opportunities o JOIN crm_contacts c ON c.id = o.contact_id
        WHERE ${w.sql} AND o.closed_at IS NULL GROUP BY o.stage`,
      args: w.args,
    }),
    db().execute({
      sql: `SELECT o.stage AS stage, COUNT(*) AS n, SUM(o.value_eur) AS value FROM crm_opportunities o JOIN crm_contacts c ON c.id = o.contact_id
        WHERE ${closed} AND o.stage IN ('vinto','perso') GROUP BY o.stage`,
      args: closedArgs,
    }),
  ]);
  const byStage = { nuovo: 0, contattato: 0, call: 0, preventivo: 0, vinto: 0, perso: 0 };
  let openCount = 0, openValue = 0;
  for (const row of openRows.rows) {
    if (!isStage(row.stage)) continue;
    byStage[row.stage] = Number(row.n);
    openCount += Number(row.n);
    openValue += Number(row.value ?? 0);
  }
  let won = 0, lost = 0, wonValue = 0;
  for (const row of doneRows.rows) {
    if (row.stage === "vinto") { won = Number(row.n); wonValue = Number(row.value ?? 0); }
    if (row.stage === "perso") lost = Number(row.n);
  }
  return { open: openCount, byStage, won, lost, wonValue, openValue };
}

export async function searchDealContacts(q: string): Promise<{ id: string; name: string; city: string | null }[]> {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  await ensureCrmSchema();
  const like = `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const res = await db().execute({
    sql: `SELECT id, business_name, city FROM crm_contacts WHERE archived = 0 AND business_name LIKE ? ESCAPE '\\' ORDER BY business_name LIMIT 8`,
    args: [like],
  });
  return res.rows.map((r) => ({ id: String(r.id), name: String(r.business_name), city: r.city ? String(r.city) : null }));
}

export type CreateDealResult = { id: string; created: boolean } | { error: "missing" | "open" | "invalid" };

/** Inserts one open deal. A repeated idempotency key returns the existing id and writes nothing new. */
export async function createOpportunity(draft: DealDraft, createdBy: string): Promise<CreateDealResult> {
  const title = draft.title.trim().slice(0, 200);
  if (!title || !draft.contactId) return { error: "invalid" };
  return withWrite(async () => {
    const tx = await db().transaction("write");
    try {
      if (draft.idempotencyKey) {
        const again = await tx.execute({ sql: "SELECT id FROM crm_opportunities WHERE idempotency_key = ?", args: [draft.idempotencyKey] });
        if (again.rows[0]) return { id: String(again.rows[0].id), created: false };
      }
      const contact = await tx.execute({ sql: "SELECT source, archived FROM crm_contacts WHERE id = ?", args: [draft.contactId] });
      const row = contact.rows[0];
      if (!row || Number(row.archived) === 1 || !isSource(row.source)) return { error: "missing" };
      const open = await tx.execute({ sql: "SELECT id FROM crm_opportunities WHERE contact_id = ? AND closed_at IS NULL", args: [draft.contactId] });
      if (open.rows[0]) return { error: "open" };
      const id = crypto.randomUUID();
      const closed = isClosedStage(draft.stage) ? new Date().toISOString() : null;
      await tx.execute({
        sql: `INSERT INTO crm_opportunities (id, contact_id, title, stage, value_eur, owner_user_id, source, priority, opened_at, closed_at, version, idempotency_key, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, 1, ?, ?)`,
        args: [id, draft.contactId, title, draft.stage, draft.valueEur, draft.ownerUserId, row.source, draft.priority, closed, draft.idempotencyKey, createdBy],
      });
      await tx.commit();
      return { id, created: true };
    } catch (error) {
      if (constraint(error)) return { error: "open" };
      throw error;
    } finally { tx.close(); }
  });
}

export type MoveDealResult = { from: Stage } | "conflict" | "open" | "missing";

/** Moves the deal only. Closing (vinto/perso) sets closed_at; reopening fails when another open deal exists. */
export async function moveOpportunity(id: string, stage: Stage, expectedVersion: number): Promise<MoveDealResult> {
  return withWrite(async () => {
    const tx = await db().transaction("write");
    try {
      const cur = await tx.execute({ sql: "SELECT stage, version, contact_id FROM crm_opportunities WHERE id = ?", args: [id] });
      const row = cur.rows[0];
      if (!row || !isStage(row.stage)) return "missing";
      if (Number(row.version) !== expectedVersion) return "conflict";
      if (row.stage === stage) return { from: row.stage };
      if (!isClosedStage(stage)) {
        const other = await tx.execute({ sql: "SELECT id FROM crm_opportunities WHERE contact_id = ? AND closed_at IS NULL AND id <> ?", args: [String(row.contact_id), id] });
        if (other.rows[0]) return "open";
      }
      const closed = isClosedStage(stage) ? new Date().toISOString() : null;
      const upd = await tx.execute({
        sql: `UPDATE crm_opportunities SET stage = ?, closed_at = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND version = ?`,
        args: [stage, closed, id, expectedVersion],
      });
      if (!upd.rowsAffected) return "conflict";
      await tx.commit();
      return { from: row.stage };
    } catch (error) {
      if (constraint(error)) return "open";
      throw error;
    } finally { tx.close(); }
  });
}

export type PatchDeal = { title?: string; valueEur?: number | null; ownerUserId?: string | null; priority?: DealPriority | null };

export async function updateOpportunity(id: string, patch: PatchDeal, expectedVersion: number): Promise<"ok" | "conflict" | "missing" | "invalid"> {
  const title = patch.title === undefined ? undefined : patch.title.trim().slice(0, 200);
  if (title !== undefined && !title) return "invalid";
  return withWrite(async () => {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (title !== undefined) { sets.push("title = ?"); args.push(title); }
    if (patch.valueEur !== undefined) { sets.push("value_eur = ?"); args.push(patch.valueEur); }
    if (patch.ownerUserId !== undefined) { sets.push("owner_user_id = ?"); args.push(patch.ownerUserId); }
    if (patch.priority !== undefined) { sets.push("priority = ?"); args.push(patch.priority); }
    sets.push("version = version + 1", "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    args.push(id, expectedVersion);
    const res = await db().execute({ sql: `UPDATE crm_opportunities SET ${sets.join(", ")} WHERE id = ? AND version = ?`, args });
    if (res.rowsAffected) return "ok";
    const cur = await db().execute({ sql: "SELECT 1 FROM crm_opportunities WHERE id = ?", args: [id] });
    return cur.rows[0] ? "conflict" : "missing";
  });
}
