import "server-only";
import type { InValue } from "@libsql/client";
import { CAN_SIGN_IN_SQL, ROLES_SQL, rowRoles } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureAuditSchema, ensureCrmSchema } from "@/lib/migrate";
import { dedupeKeys, hasKeys, isSource, isStage, STAGES, type DraftStatus, type IngestContact, type Source, type Stage } from "@/lib/crm-core";
import { canAccess, type Perms } from "@/lib/team-types";

export type Contact = {
  id: string; businessName: string; type: string | null; contactName: string | null; email: string | null; phone: string | null;
  website: string | null; address: string | null; city: string | null; region: string | null; source: Source; score: number | null;
  scoreReasons: string[]; stage: Stage; valueEur: number | null; nextAction: string | null; nextActionAt: string | null;
  ownerUserId: string | null; ownerName: string | null; notes: string | null; createdAt: string; updatedAt: string; archived: boolean;
  /** Optimistic-lock counter: every write bumps it, conditional writes compare it. */
  version: number;
  /** false when the responsible person left the team (account disabled, removed or deleted); null without owner. */
  ownerActive: boolean | null;
  stageChangedAt: string | null;
  /** Set only when this row was created from an Iris search request. Never written onto a duplicate. */
  irisRequestId: string | null;
};
export type ContactInput = {
  businessName: string; type?: string | null; contactName?: string | null; email?: string | null; phone?: string | null; website?: string | null;
  address?: string | null; city?: string | null; region?: string | null; source: Source; score?: number | null; scoreReasons?: string[] | null;
  stage?: Stage; valueEur?: number | null; nextAction?: string | null; nextActionAt?: string | null; ownerUserId?: string | null; notes?: string | null;
};
export type Draft = { id: string; contactId: string; subject: string; bodyHtml: string | null; bodyText: string; status: DraftStatus; createdAt: string; sentAt: string | null; sentBy: string | null };

const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function reasons(v: unknown): string[] {
  try { const a = JSON.parse(String(v ?? "[]")); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

const COLS = `c.id, c.business_name, c.type, c.contact_name, c.email, c.phone, c.website, c.address, c.city, c.region, c.source, c.score,
  c.score_reasons, c.stage, c.value_eur, c.next_action, c.next_action_at, c.owner_user_id, u.name AS owner_name, c.notes, c.created_at, c.updated_at, c.archived,
  c.version, c.stage_changed_at, c.iris_request_id, CASE WHEN c.owner_user_id IS NULL THEN NULL WHEN u.id IS NOT NULL AND u.active = 1 AND u.invite_state IS NULL AND u.removed_at IS NULL THEN 1 ELSE 0 END AS owner_active`;
const FROM = "FROM crm_contacts c LEFT JOIN admin_users u ON u.id = c.owner_user_id";

function toContact(r: Record<string, unknown>): Contact {
  return {
    id: String(r.id), businessName: String(r.business_name), type: s(r.type), contactName: s(r.contact_name), email: s(r.email), phone: s(r.phone),
    website: s(r.website), address: s(r.address), city: s(r.city), region: s(r.region), source: isSource(r.source) ? r.source : "manuale",
    score: n(r.score), scoreReasons: reasons(r.score_reasons), stage: isStage(r.stage) ? r.stage : "nuovo", valueEur: n(r.value_eur),
    nextAction: s(r.next_action), nextActionAt: s(r.next_action_at), ownerUserId: s(r.owner_user_id), ownerName: s(r.owner_name), notes: s(r.notes),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at), archived: Number(r.archived) === 1,
    version: Number(r.version ?? 1), ownerActive: r.owner_active === null || r.owner_active === undefined ? null : Number(r.owner_active) === 1,
    stageChangedAt: s(r.stage_changed_at), irisRequestId: s(r.iris_request_id),
  };
}

/** Id of an existing contact sharing email, phone or company domain (archived ones too), else null. */
export async function findDuplicate(c: { email?: string | null; phone?: string | null; website?: string | null }, excludeId?: string): Promise<string | null> {
  await ensureCrmSchema();
  const k = dedupeKeys(c);
  if (!hasKeys(k)) return null;
  const res = await db().execute({
    sql: `SELECT id FROM crm_contacts WHERE id <> ? AND ((? <> '' AND email_norm = ?) OR (? <> '' AND phone_norm = ?) OR (? <> '' AND domain = ?)) ORDER BY archived, created_at LIMIT 1`,
    args: [excludeId ?? "", k.email, k.email, k.phone, k.phone, k.domain, k.domain],
  });
  return res.rows[0] ? String(res.rows[0].id) : null;
}

const fieldArgs = (c: ContactInput): InValue[] => {
  const k = dedupeKeys(c);
  return [
    c.businessName, c.type ?? null, c.contactName ?? null, c.email?.trim() || null, c.phone?.trim() || null, c.website?.trim() || null,
    c.address ?? null, c.city ?? null, c.region ?? null, c.score ?? null, c.scoreReasons?.length ? JSON.stringify(c.scoreReasons) : null,
    c.valueEur ?? null, c.nextAction ?? null, c.nextActionAt ?? null, c.ownerUserId ?? null, c.notes ?? null, k.email, k.phone, k.domain,
  ];
};

const INSERT_CONTACT = `INSERT INTO crm_contacts (business_name, type, contact_name, email, phone, website, address, city, region, score, score_reasons, value_eur,
  next_action, next_action_at, owner_user_id, notes, email_norm, phone_norm, domain, id, source, stage, created_by, request_id, iris_request_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/**
 * Inserts unless a duplicate exists. The check and the insert share one write transaction, so two concurrent
 * creates of the same contact cannot both pass the check. Returns the new id, or the duplicate's id with
 * duplicate = true. Never updates the existing row.
 */
export async function createContact(c: ContactInput, createdBy: string | null, extra: { requestId?: string; createdAt?: string; irisRequestId?: string | null } = {}): Promise<{ id: string; duplicate: boolean }> {
  await ensureCrmSchema();
  for (let attempt = 1; ; attempt++) {
    try {
      return await insertContact(c, createdBy, extra);
    } catch (error) {
      const busy = /SQLITE_BUSY|database is locked/i.test(String((error as Error)?.message ?? error));
      if (!busy || attempt >= 5) throw error;
      await new Promise((r) => setTimeout(r, 25 * attempt));
    }
  }
}

async function insertContact(c: ContactInput, createdBy: string | null, extra: { requestId?: string; createdAt?: string; irisRequestId?: string | null }): Promise<{ id: string; duplicate: boolean }> {
  const tx = await db().transaction("write");
  try {
    const k = dedupeKeys(c);
    if (hasKeys(k)) {
      const res = await tx.execute({
        sql: `SELECT id FROM crm_contacts WHERE (? <> '' AND email_norm = ?) OR (? <> '' AND phone_norm = ?) OR (? <> '' AND domain = ?) ORDER BY archived, created_at LIMIT 1`,
        args: [k.email, k.email, k.phone, k.phone, k.domain, k.domain],
      });
      const dup = res.rows[0] ? String(res.rows[0].id) : null;
      if (dup) return { id: dup, duplicate: true };
    }
    const id = crypto.randomUUID();
    await tx.execute({ sql: INSERT_CONTACT, args: [...fieldArgs(c), id, c.source, c.stage ?? "nuovo", createdBy, extra.requestId ?? null, extra.irisRequestId ?? null, extra.createdAt ?? null] });
    await tx.commit();
    return { id, duplicate: false };
  } finally {
    tx.close();
  }
}

export type WriteResult = "ok" | "notfound" | "conflict";
const BUMP = "version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')";
/** After a conditional UPDATE touched nothing: tell "someone changed it" from "it is gone". */
async function missOrConflict(id: string): Promise<"notfound" | "conflict"> {
  const r = await db().execute({ sql: "SELECT 1 FROM crm_contacts WHERE id = ?", args: [id] });
  return r.rows.length ? "conflict" : "notfound";
}

/** Full edit. With `expectedVersion` the write only happens if nobody saved the contact since it was read. */
export async function updateContact(id: string, c: ContactInput, expectedVersion?: number): Promise<WriteResult | { duplicate: string }> {
  await ensureCrmSchema();
  const dup = await findDuplicate(c, id);
  if (dup) return { duplicate: dup };
  const v = expectedVersion ?? null;
  const res = await db().execute({
    sql: `UPDATE crm_contacts SET business_name = ?, type = ?, contact_name = ?, email = ?, phone = ?, website = ?, address = ?, city = ?, region = ?,
      score = ?, score_reasons = ?, value_eur = ?, next_action = ?, next_action_at = ?, owner_user_id = ?, notes = ?, email_norm = ?, phone_norm = ?, domain = ?,
      ${BUMP} WHERE id = ? AND (? IS NULL OR version = ?)`,
    args: [...fieldArgs(c), id, v, v],
  });
  return res.rowsAffected ? "ok" : v === null ? "notfound" : missOrConflict(id);
}

/** Responsible person only (panel and bulk "Assegna"). null clears it, explicitly. */
export async function setOwner(id: string, ownerId: string | null, expectedVersion: number): Promise<WriteResult> {
  await ensureCrmSchema();
  const r = await db().execute({ sql: `UPDATE crm_contacts SET owner_user_id = ?, ${BUMP} WHERE id = ? AND archived = 0 AND version = ?`, args: [ownerId, id, expectedVersion] });
  return r.rowsAffected ? "ok" : missOrConflict(id);
}

/** The legacy follow-up (next_action / next_action_at), still the only follow-up source until the Attività phase. */
export async function setFollowUp(id: string, text: string | null, at: string | null, expectedVersion: number): Promise<WriteResult> {
  await ensureCrmSchema();
  const r = await db().execute({ sql: `UPDATE crm_contacts SET next_action = ?, next_action_at = ?, ${BUMP} WHERE id = ? AND archived = 0 AND version = ?`, args: [text, at, id, expectedVersion] });
  return r.rowsAffected ? "ok" : missOrConflict(id);
}

/**
 * Stage change. Without `expectedVersion` (kanban drag, automatic moves after a send or a Meet invite) it applies to the
 * current row; with it, only if the contact is unchanged since it was read.
 */
export async function setStage(id: string, stage: Stage, expectedVersion?: number): Promise<{ from: Stage } | "conflict" | null> {
  await ensureCrmSchema();
  const cur = await db().execute({ sql: "SELECT stage, version FROM crm_contacts WHERE id = ? AND archived = 0", args: [id] });
  const from = cur.rows[0]?.stage;
  if (!isStage(from)) return null;
  if (expectedVersion !== undefined && Number(cur.rows[0].version) !== expectedVersion) return "conflict";
  if (from === stage) return { from };
  const r = await db().execute({
    sql: `UPDATE crm_contacts SET stage = ?, stage_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), ${BUMP} WHERE id = ? AND archived = 0 AND version = ?`,
    args: [stage, id, Number(cur.rows[0].version)],
  });
  if (!r.rowsAffected) return expectedVersion === undefined ? setStage(id, stage) : "conflict";
  return { from };
}

export async function setArchived(id: string, archived: boolean) {
  await ensureCrmSchema();
  const r = await db().execute({ sql: `UPDATE crm_contacts SET archived = ?, ${BUMP} WHERE id = ?`, args: [archived ? 1 : 0, id] });
  return r.rowsAffected > 0;
}

export type ContactSort = "aggiornato" | "nome" | "fase" | "citta" | "punteggio" | "azione";
export type ContactFilter = {
  q?: string; stage?: Stage; type?: string; city?: string; source?: Source; archived?: boolean; limit?: number; offset?: number;
  /** "none" = without responsible person; otherwise a user id. */
  owner?: string; sort?: ContactSort; dir?: "asc" | "desc";
  /** Score band (inclusive); `noScore` = contacts Iris sent without a score. */
  scoreMin?: number; scoreMax?: number; noScore?: boolean;
  /** "any" = created from an Iris request; a request id = that request only. */
  iris?: "any" | string;
};
const STAGE_ORDER = `CASE c.stage ${STAGES.map((st, i) => `WHEN '${st}' THEN ${i}`).join(" ")} END`;
const SORT_SQL: Record<ContactSort, string> = {
  aggiornato: "c.updated_at", nome: "c.business_name COLLATE NOCASE", fase: STAGE_ORDER, citta: "COALESCE(c.city, '') COLLATE NOCASE",
  punteggio: "COALESCE(c.score, -1)", azione: "COALESCE(c.next_action_at, '9999')",
};
function contactWhere(f: ContactFilter): { where: string; args: InValue[] } {
  const where = ["c.archived = ?"];
  const args: InValue[] = [f.archived ? 1 : 0];
  if (f.stage) { where.push("c.stage = ?"); args.push(f.stage); }
  if (f.source) { where.push("c.source = ?"); args.push(f.source); }
  if (f.type) { where.push("c.type = ?"); args.push(f.type); }
  if (f.city) { where.push("c.city = ? COLLATE NOCASE"); args.push(f.city); }
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push("(c.business_name LIKE ? ESCAPE '\\' OR c.contact_name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.website LIKE ? ESCAPE '\\' OR c.city LIKE ? ESCAPE '\\')");
    args.push(like, like, like, like, like, like);
  }
  if (f.noScore) where.push("c.score IS NULL");
  else if (f.scoreMin !== undefined || f.scoreMax !== undefined) { where.push("c.score BETWEEN ? AND ?"); args.push(f.scoreMin ?? 0, f.scoreMax ?? 100); }
  if (f.owner === "none") where.push("c.owner_user_id IS NULL");
  else if (f.owner) { where.push("c.owner_user_id = ?"); args.push(f.owner); }
  if (f.iris === "any") where.push("c.iris_request_id IS NOT NULL");
  else if (f.iris) { where.push("c.iris_request_id = ?"); args.push(f.iris); }
  return { where: where.join(" AND "), args };
}
export async function listContacts(f: ContactFilter = {}): Promise<Contact[]> {
  await ensureCrmSchema();
  const { where, args } = contactWhere(f);
  const order = `${SORT_SQL[f.sort ?? "aggiornato"]} ${f.dir === "asc" ? "ASC" : "DESC"}, c.id`;
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, args: [...args, f.limit ?? 500, f.offset ?? 0] });
  return res.rows.map((r) => toContact(r as Record<string, unknown>));
}
export type ContactTouch = { at: string; name: string | null };

/**
 * Latest documented send for each contact: a successful outreach send, a Radar draft marked sent, or the audit row of
 * that send. The owner and the stage are not evidence. The result is a name and a time, never an email address.
 * No row means the author cannot be reconstructed.
 */
export async function contactTouches(ids: string[]): Promise<Map<string, ContactTouch>> {
  const out = new Map<string, ContactTouch>();
  const unique = [...new Set(ids.filter((id) => id))];
  if (!unique.length) return out;
  await ensureCrmSchema();
  await ensureAuditSchema();
  const consider = (id: unknown, at: unknown, name: unknown) => {
    if (!id || !at) return;
    const key = String(id);
    const when = String(at);
    const who = name ? String(name) : null;
    const prev = out.get(key);
    if (!prev || when > prev.at) out.set(key, { at: when, name: who });
    else if (when === prev.at && !prev.name && who) out.set(key, { at: when, name: who });
  };
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const marks = chunk.map(() => "?").join(",");
    const [outreach, drafts, audits] = await Promise.all([
      db().execute({
        sql: `SELECT o.contact_id AS id, o.last_sent_at AS at, u.name AS name FROM crm_outreach o
          LEFT JOIN admin_users u ON u.id = o.last_sent_by WHERE o.last_sent_at IS NOT NULL AND o.contact_id IN (${marks})`,
        args: chunk,
      }),
      db().execute({
        sql: `SELECT d.contact_id AS id, d.sent_at AS at, u.name AS name FROM crm_drafts d
          LEFT JOIN admin_users u ON u.id = d.sent_by WHERE d.status = 'inviata' AND d.sent_at IS NOT NULL AND d.contact_id IN (${marks})`,
        args: chunk,
      }),
      db().execute({
        sql: `SELECT json_extract(details, '$.contact') AS id, created_at AS at, user_name AS name FROM audit_log
          WHERE action = 'crm.draft_sent' AND json_extract(details, '$.contact') IN (${marks})`,
        args: chunk,
      }),
    ]);
    for (const row of [...outreach.rows, ...drafts.rows, ...audits.rows]) consider(row.id, row.at, row.name);
  }
  return out;
}

export async function countContacts(f: ContactFilter = {}): Promise<number> {
  await ensureCrmSchema();
  const { where, args } = contactWhere(f);
  const r = await db().execute({ sql: `SELECT COUNT(*) AS n FROM crm_contacts c WHERE ${where}`, args });
  return Number(r.rows[0]?.n ?? 0);
}

export async function getContact(id: string): Promise<Contact | null> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE c.id = ?`, args: [id] });
  return res.rows[0] ? toContact(res.rows[0] as Record<string, unknown>) : null;
}

/** Distinct categories and cities for the filter menus. */
export async function facets(source?: Source): Promise<{ types: string[]; cities: string[] }> {
  await ensureCrmSchema();
  const only = source ? " AND source = ?" : "", args = source ? [source] : [];
  const [t, c] = await Promise.all([
    db().execute({ sql: `SELECT DISTINCT type FROM crm_contacts WHERE archived = 0 AND type IS NOT NULL AND type <> ''${only} ORDER BY type LIMIT 200`, args }),
    db().execute({ sql: `SELECT DISTINCT city FROM crm_contacts WHERE archived = 0 AND city IS NOT NULL AND city <> ''${only} ORDER BY city COLLATE NOCASE LIMIT 300`, args }),
  ]);
  return { types: t.rows.map((r) => String(r.type)), cities: c.rows.map((r) => String(r.city)) };
}

export type Note = { id: string; body: string; createdAt: string; author: string | null };
export async function listNotes(contactId: string): Promise<Note[]> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: "SELECT n.id, n.body, n.created_at, u.name FROM crm_notes n LEFT JOIN admin_users u ON u.id = n.user_id WHERE n.contact_id = ? ORDER BY n.created_at DESC LIMIT 200", args: [contactId] });
  return res.rows.map((r) => ({ id: String(r.id), body: String(r.body), createdAt: String(r.created_at), author: s(r.name) }));
}
export async function addNote(contactId: string, userId: string | null, body: string) {
  await ensureCrmSchema();
  await db().batch([
    { sql: "INSERT INTO crm_notes (id, contact_id, user_id, body) VALUES (?, ?, ?, ?)", args: [crypto.randomUUID(), contactId, userId, body] },
    { sql: "UPDATE crm_contacts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [contactId] },
  ], "write");
}

const toDraft = (r: Record<string, unknown>): Draft => ({
  id: String(r.id), contactId: String(r.contact_id), subject: String(r.subject), bodyHtml: s(r.body_html), bodyText: String(r.body_text),
  status: (["bozza", "inviata", "scartata"].includes(String(r.status)) ? r.status : "bozza") as DraftStatus,
  createdAt: String(r.created_at), sentAt: s(r.sent_at), sentBy: s(r.sent_by),
});
export async function listDrafts(contactIds: string[]): Promise<Draft[]> {
  await ensureCrmSchema();
  if (!contactIds.length) return [];
  const res = await db().execute({ sql: `SELECT * FROM crm_drafts WHERE contact_id IN (${contactIds.map(() => "?").join(",")}) ORDER BY created_at DESC`, args: contactIds });
  return res.rows.map((r) => toDraft(r as Record<string, unknown>));
}
export async function getDraft(id: string): Promise<Draft | null> {
  await ensureCrmSchema();
  const r = await db().execute({ sql: "SELECT * FROM crm_drafts WHERE id = ?", args: [id] });
  return r.rows[0] ? toDraft(r.rows[0] as Record<string, unknown>) : null;
}
export async function addDraft(contactId: string, d: { subject: string; bodyText: string; bodyHtml?: string | null }) {
  await ensureCrmSchema();
  const id = crypto.randomUUID();
  await db().execute({ sql: "INSERT INTO crm_drafts (id, contact_id, subject, body_html, body_text) VALUES (?, ?, ?, ?, ?)", args: [id, contactId, d.subject, d.bodyHtml ?? null, d.bodyText] });
  return id;
}

/** Ingest one prospect from the external assistant: dedupe, insert as source 'radar', optional draft. A duplicate is never updated, so irisRequestId sticks only to a new row. */
export async function ingestContact(c: IngestContact, irisRequestId?: string | null): Promise<{ id: string; duplicate: boolean }> {
  const r = await createContact({
    businessName: c.business_name, type: c.type, contactName: c.contact_name, email: c.email || null, phone: c.phone, website: c.website,
    address: c.address, city: c.city, region: c.region, source: "radar", score: c.score ?? null, scoreReasons: c.score_reasons ?? null, notes: c.notes,
  }, null, { irisRequestId: irisRequestId ?? null });
  if (!r.duplicate && c.draft) await addDraft(r.id, { subject: c.draft.subject, bodyText: c.draft.body_text, bodyHtml: c.draft.body_html });
  return r;
}

/** New site request -> CRM lead (source 'sito'). Idempotent per request id; never throws (the public form must not break). */
export async function leadFromRequest(req: { id: string; name: string; email: string; subject?: string; message?: string; createdAt?: string }): Promise<void> {
  try {
    await ensureCrmSchema();
    const known = await db().execute({ sql: "SELECT 1 FROM crm_contacts WHERE request_id = ?", args: [req.id] });
    if (known.rows.length) return;
    const dup = await findDuplicate({ email: req.email });
    if (dup) {
      await addNote(dup, null, `Nuova richiesta dal sito${req.subject ? `: ${req.subject}` : ""}\n\n${(req.message ?? "").slice(0, 4000)}`);
      return;
    }
    await createContact({
      businessName: req.name.slice(0, 200), contactName: req.name.slice(0, 120), email: req.email, source: "sito",
      nextAction: "Rispondere alla richiesta", notes: [req.subject, req.message].filter(Boolean).join("\n\n").slice(0, 5000) || null,
    }, null, { requestId: req.id, createdAt: req.createdAt });
  } catch (error) {
    console.error("[crm] lead dal sito non creato:", error instanceof Error ? error.message : error);
  }
}

let backfilled: Promise<void> | null = null;
/** Once per server instance: every stored site request gets its lead (idempotent, safe to repeat). */
export function backfillRequests(): Promise<void> {
  backfilled ??= (async () => {
    await ensureCrmSchema();
    const res = await db().execute(`SELECT r.id, r.name, r.email, r.subject, r.message, r.created_at FROM contact_requests r
      WHERE NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.request_id = r.id) ORDER BY r.created_at LIMIT 2000`).catch(() => ({ rows: [] }));
    for (const r of res.rows) await leadFromRequest({ id: String(r.id), name: String(r.name), email: String(r.email), subject: String(r.subject ?? ""), message: String(r.message ?? ""), createdAt: String(r.created_at) });
  })().catch((error) => { backfilled = null; throw error; });
  return backfilled;
}

export type CrmStats = { leadsMonth: number; won: number; lost: number; openValue: number; wonValue: number };
export async function crmStats(now = new Date()): Promise<CrmStats> {
  await ensureCrmSchema();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(now);
  const r = await db().execute({
    sql: `SELECT
      SUM(CASE WHEN substr(created_at, 1, 7) = ? THEN 1 ELSE 0 END) AS leads,
      SUM(CASE WHEN stage = 'vinto' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage = 'perso' THEN 1 ELSE 0 END) AS lost,
      SUM(CASE WHEN stage NOT IN ('vinto','perso') THEN COALESCE(value_eur, 0) ELSE 0 END) AS open_value,
      SUM(CASE WHEN stage = 'vinto' THEN COALESCE(value_eur, 0) ELSE 0 END) AS won_value
      FROM crm_contacts WHERE archived = 0`,
    args: [month],
  });
  const x = r.rows[0] ?? {};
  return { leadsMonth: Number(x.leads ?? 0), won: Number(x.won ?? 0), lost: Number(x.lost ?? 0), openValue: Number(x.open_value ?? 0), wonValue: Number(x.won_value ?? 0) };
}

export type DueAction = { id: string; businessName: string; nextAction: string | null; nextActionAt: string; stage: Stage; ownerUserId: string | null; ownerName: string | null };
/** Open contacts whose next action is due by `until` (Rome date, default today), overdue included. ownerId null = everyone's. */
export async function dueActions(ownerId: string | null, today: string, until = today): Promise<DueAction[]> {
  await ensureCrmSchema();
  const end = until > today ? until : today;
  const res = await db().execute({
    sql: `SELECT c.id, c.business_name, c.next_action, c.next_action_at, c.stage, c.owner_user_id, u.name AS owner_name ${FROM}
      WHERE c.archived = 0 AND c.stage NOT IN ('vinto','perso') AND c.next_action_at IS NOT NULL AND substr(c.next_action_at, 1, 10) <= ?
      ${ownerId ? "AND (c.owner_user_id = ? OR (c.owner_user_id IS NULL AND c.created_by = ?))" : ""} ORDER BY c.next_action_at LIMIT 50`,
    args: ownerId ? [end, ownerId, ownerId] : [end],
  });
  return res.rows.map((r) => ({ id: String(r.id), businessName: String(r.business_name), nextAction: s(r.next_action), nextActionAt: String(r.next_action_at), stage: isStage(r.stage) ? r.stage : "nuovo", ownerUserId: r.owner_user_id ? String(r.owner_user_id) : null, ownerName: s(r.owner_name) }));
}

/**
 * Marks the legacy follow-up done: clears next_action/next_action_at and keeps the text as a note.
 * `seenAt` is the date the person saw: if someone changed the follow-up meanwhile, nothing is cleared.
 */
export async function completeFollowUp(id: string, seenAt: string, userId: string): Promise<"ok" | "changed"> {
  await ensureCrmSchema();
  const cur = await db().execute({ sql: "SELECT next_action FROM crm_contacts WHERE id = ? AND archived = 0 AND next_action_at = ?", args: [id, seenAt] });
  if (!cur.rows.length) return "changed";
  const text = s(cur.rows[0].next_action) ?? "Prossima azione";
  const r = await db().execute({
    sql: `UPDATE crm_contacts SET next_action = NULL, next_action_at = NULL, ${BUMP} WHERE id = ? AND archived = 0 AND next_action_at = ?`,
    args: [id, seenAt],
  });
  if (!r.rowsAffected) return "changed";
  await addNote(id, userId, `Follow-up completato: ${text}`.slice(0, 5000));
  return "ok";
}

export type CrmOverview = { total: number; newThisMonth: number; byStage: Record<Stage, number>; wonValue: number; radar: number; unassigned: number };
const STAGES_SQL = STAGES.map((st) => `SUM(CASE WHEN stage = '${st}' THEN 1 ELSE 0 END) AS n_${st}`).join(", ");
/** Contact counts for the Oggi page. Deal counts live in opportunityTotals and are not derived from these stages. */
export async function crmOverview(now = new Date()): Promise<CrmOverview> {
  await ensureCrmSchema();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(now);
  const r = await db().execute({
    sql: `SELECT COUNT(*) AS total,
      SUM(CASE WHEN substr(created_at, 1, 7) = ? THEN 1 ELSE 0 END) AS month_new,
      ${STAGES_SQL},
      SUM(CASE WHEN stage = 'vinto' THEN COALESCE(value_eur, 0) ELSE 0 END) AS won_value,
      SUM(CASE WHEN source = 'radar' THEN 1 ELSE 0 END) AS radar,
      SUM(CASE WHEN owner_user_id IS NULL AND stage NOT IN ('vinto','perso') THEN 1 ELSE 0 END) AS unassigned
      FROM crm_contacts WHERE archived = 0`,
    args: [month],
  });
  const x = r.rows[0] ?? {};
  const byStage = Object.fromEntries(STAGES.map((st) => [st, Number(x[`n_${st}`] ?? 0)])) as Record<Stage, number>;
  return {
    total: Number(x.total ?? 0), newThisMonth: Number(x.month_new ?? 0), byStage, wonValue: Number(x.won_value ?? 0),
    radar: Number(x.radar ?? 0), unassigned: Number(x.unassigned ?? 0),
  };
}

/** Highest commercial score among open contacts. Oggi shows this short list, and its length, not every scored contact. */
export async function priorityContacts(limit = 3): Promise<Contact[]> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `SELECT ${COLS} ${FROM} WHERE c.archived = 0 AND c.stage NOT IN ('vinto','perso') AND c.score IS NOT NULL ORDER BY c.score DESC, c.updated_at DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => toContact(r as Record<string, unknown>));
}

/** Open contacts without a responsible person, newest first (site leads and Radar arrivals land here). */
export async function unassignedContacts(limit = 5): Promise<Contact[]> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `SELECT ${COLS} ${FROM} WHERE c.archived = 0 AND c.owner_user_id IS NULL AND c.stage NOT IN ('vinto','perso') ORDER BY c.created_at DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => toContact(r as Record<string, unknown>));
}

export type CrmEvent = { id: number; action: string; at: string; actor: string | null; contactId: string | null; contactName: string | null; details: Record<string, unknown> };
/** Latest CRM entries of the audit log (no IP or user agent). The log is purged after 12 months: this is a recent feed, not a history. */
export async function recentCrmEvents(limit = 6): Promise<CrmEvent[]> {
  await Promise.all([ensureCrmSchema(), ensureAuditSchema()]);
  const res = await db().execute({
    sql: `SELECT a.id, a.action, a.created_at, a.user_name, a.details, c.id AS contact_id, c.business_name
      FROM audit_log a LEFT JOIN crm_contacts c ON a.target_type = 'crm_contact' AND c.id = a.target_id
      WHERE a.action LIKE 'crm.%' ORDER BY a.id DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => {
    let details: Record<string, unknown> = {};
    try { const d = JSON.parse(String(r.details ?? "{}")); if (d && typeof d === "object") details = d; } catch { /* malformed details: show the event without them */ }
    return { id: Number(r.id), action: String(r.action), at: String(r.created_at), actor: s(r.user_name), contactId: s(r.contact_id), contactName: s(r.business_name), details };
  });
}

export type InviteContact = { id: string; name: string; email: string; label: string };
/** Contacts offered by the Meet client invite. CRM data: empty for anyone without the crm permission. */
export async function inviteContacts(user: Perms): Promise<InviteContact[]> {
  if (!canAccess(user, "crm")) return [];
  return (await listContacts({ limit: 300 }))
    .filter((c) => c.email)
    .map((c) => ({ id: c.id, name: c.contactName || c.businessName, email: c.email!, label: `${c.businessName}${c.contactName ? ` (${c.contactName})` : ""} · ${c.email}` }));
}

/** People who can be made responsible: active accounts that can open the CRM. */
export async function crmOwners(): Promise<{ id: string; name: string }[]> {
  const r = await db().execute(`SELECT id, name, role, ${ROLES_SQL} FROM admin_users WHERE ${CAN_SIGN_IN_SQL} ORDER BY name`);
  return r.rows.filter((x) => canAccess({ roles: rowRoles(x as Record<string, unknown>) }, "crm")).map((x) => ({ id: String(x.id), name: String(x.name) }));
}

export type RadarStats = { total: number; toReview: number; priority: number; draftsReady: number; inDeal: number };
/**
 * Radar KPIs, read-only over what the ingest already writes (source 'radar' contacts and their drafts). "priority" =
 * still new with a score of 70+; "draftsReady" = Iris drafts waiting for someone to review and send.
 */
export async function radarStats(): Promise<RadarStats> {
  await ensureCrmSchema();
  const [c, d] = await Promise.all([
    db().execute(`SELECT COUNT(*) AS total, SUM(CASE WHEN stage = 'nuovo' THEN 1 ELSE 0 END) AS to_review,
      SUM(CASE WHEN stage = 'nuovo' AND score >= 70 THEN 1 ELSE 0 END) AS priority, SUM(CASE WHEN stage IN ('call','preventivo') THEN 1 ELSE 0 END) AS in_deal
      FROM crm_contacts WHERE archived = 0 AND source = 'radar'`),
    db().execute("SELECT COUNT(*) AS n FROM crm_drafts d JOIN crm_contacts c ON c.id = d.contact_id WHERE d.status = 'bozza' AND c.archived = 0 AND c.source = 'radar'"),
  ]);
  const x = c.rows[0] ?? {};
  return { total: Number(x.total ?? 0), toReview: Number(x.to_review ?? 0), priority: Number(x.priority ?? 0), draftsReady: Number(d.rows[0]?.n ?? 0), inDeal: Number(x.in_deal ?? 0) };
}

export type RubricaStats = { total: number; contacted: number; inDeal: number; won: number; followUpDue: number };
/** Rubrica KPIs over open (not archived) contacts. "followUpDue" = open contacts whose follow-up is due today or earlier. */
export async function rubricaStats(today: string): Promise<RubricaStats> {
  await ensureCrmSchema();
  const r = await db().execute({
    sql: `SELECT COUNT(*) AS total, SUM(CASE WHEN stage = 'contattato' THEN 1 ELSE 0 END) AS contacted,
      SUM(CASE WHEN stage IN ('call','preventivo') THEN 1 ELSE 0 END) AS in_deal, SUM(CASE WHEN stage = 'vinto' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage NOT IN ('vinto','perso') AND next_action_at IS NOT NULL AND substr(next_action_at, 1, 10) <= ? THEN 1 ELSE 0 END) AS due
      FROM crm_contacts WHERE archived = 0`,
    args: [today],
  });
  const x = r.rows[0] ?? {};
  return { total: Number(x.total ?? 0), contacted: Number(x.contacted ?? 0), inDeal: Number(x.in_deal ?? 0), won: Number(x.won ?? 0), followUpDue: Number(x.due ?? 0) };
}

/**
 * Audit entries about one contact (its own events and Radar sends that name it). The audit log is purged after
 * 12 months, so this is the recent history, not a permanent one.
 */
export async function contactHistory(id: string, limit = 50): Promise<CrmEvent[]> {
  await Promise.all([ensureCrmSchema(), ensureAuditSchema()]);
  const res = await db().execute({
    sql: `SELECT a.id, a.action, a.created_at, a.user_name, a.details FROM audit_log a
      WHERE a.action LIKE 'crm.%' AND ((a.target_type = 'crm_contact' AND a.target_id = ?) OR (a.action = 'crm.draft_sent' AND json_extract(a.details, '$.contact') = ?))
      ORDER BY a.id DESC LIMIT ?`,
    args: [id, id, limit],
  });
  return res.rows.map((r) => {
    let details: Record<string, unknown> = {};
    try { const d = JSON.parse(String(r.details ?? "{}")); if (d && typeof d === "object") details = d; } catch { /* malformed details: keep the event */ }
    return { id: Number(r.id), action: String(r.action), at: String(r.created_at), actor: s(r.user_name), contactId: id, contactName: null, details };
  });
}
