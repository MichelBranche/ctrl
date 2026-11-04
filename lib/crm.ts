import "server-only";
import type { InValue } from "@libsql/client";
import { CAN_SIGN_IN_SQL } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureCrmSchema } from "@/lib/migrate";
import { dedupeKeys, hasKeys, isSource, isStage, type DraftStatus, type IngestContact, type Source, type Stage } from "@/lib/crm-core";

export type Contact = {
  id: string; businessName: string; type: string | null; contactName: string | null; email: string | null; phone: string | null;
  website: string | null; address: string | null; city: string | null; region: string | null; source: Source; score: number | null;
  scoreReasons: string[]; stage: Stage; valueEur: number | null; nextAction: string | null; nextActionAt: string | null;
  ownerUserId: string | null; ownerName: string | null; notes: string | null; createdAt: string; updatedAt: string; archived: boolean;
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
  c.score_reasons, c.stage, c.value_eur, c.next_action, c.next_action_at, c.owner_user_id, u.name AS owner_name, c.notes, c.created_at, c.updated_at, c.archived`;
const FROM = "FROM crm_contacts c LEFT JOIN admin_users u ON u.id = c.owner_user_id";

function toContact(r: Record<string, unknown>): Contact {
  return {
    id: String(r.id), businessName: String(r.business_name), type: s(r.type), contactName: s(r.contact_name), email: s(r.email), phone: s(r.phone),
    website: s(r.website), address: s(r.address), city: s(r.city), region: s(r.region), source: isSource(r.source) ? r.source : "manuale",
    score: n(r.score), scoreReasons: reasons(r.score_reasons), stage: isStage(r.stage) ? r.stage : "nuovo", valueEur: n(r.value_eur),
    nextAction: s(r.next_action), nextActionAt: s(r.next_action_at), ownerUserId: s(r.owner_user_id), ownerName: s(r.owner_name), notes: s(r.notes),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at), archived: Number(r.archived) === 1,
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

/** Inserts unless a duplicate exists. Returns the new id, or the duplicate's id with duplicate = true. */
export async function createContact(c: ContactInput, createdBy: string | null, extra: { requestId?: string; createdAt?: string } = {}): Promise<{ id: string; duplicate: boolean }> {
  const dup = await findDuplicate(c);
  if (dup) return { id: dup, duplicate: true };
  const id = crypto.randomUUID();
  await db().execute({
    sql: `INSERT INTO crm_contacts (business_name, type, contact_name, email, phone, website, address, city, region, score, score_reasons, value_eur,
      next_action, next_action_at, owner_user_id, notes, email_norm, phone_norm, domain, id, source, stage, created_by, request_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    args: [...fieldArgs(c), id, c.source, c.stage ?? "nuovo", createdBy, extra.requestId ?? null, extra.createdAt ?? null],
  });
  return { id, duplicate: false };
}

export async function updateContact(id: string, c: ContactInput): Promise<"ok" | "notfound" | { duplicate: string }> {
  const dup = await findDuplicate(c, id);
  if (dup) return { duplicate: dup };
  const res = await db().execute({
    sql: `UPDATE crm_contacts SET business_name = ?, type = ?, contact_name = ?, email = ?, phone = ?, website = ?, address = ?, city = ?, region = ?,
      score = ?, score_reasons = ?, value_eur = ?, next_action = ?, next_action_at = ?, owner_user_id = ?, notes = ?, email_norm = ?, phone_norm = ?, domain = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    args: [...fieldArgs(c), id],
  });
  return res.rowsAffected ? "ok" : "notfound";
}

export async function setStage(id: string, stage: Stage): Promise<{ from: Stage } | null> {
  await ensureCrmSchema();
  const cur = await db().execute({ sql: "SELECT stage FROM crm_contacts WHERE id = ? AND archived = 0", args: [id] });
  const from = cur.rows[0]?.stage;
  if (!isStage(from)) return null;
  if (from !== stage) await db().execute({ sql: "UPDATE crm_contacts SET stage = ?, stage_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [stage, id] });
  return { from };
}

export async function setArchived(id: string, archived: boolean) {
  await ensureCrmSchema();
  const r = await db().execute({ sql: "UPDATE crm_contacts SET archived = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [archived ? 1 : 0, id] });
  return r.rowsAffected > 0;
}

export type ContactFilter = { q?: string; stage?: Stage; type?: string; city?: string; source?: Source; archived?: boolean; limit?: number };
export async function listContacts(f: ContactFilter = {}): Promise<Contact[]> {
  await ensureCrmSchema();
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
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE ${where.join(" AND ")} ORDER BY c.updated_at DESC LIMIT ?`, args: [...args, f.limit ?? 500] });
  return res.rows.map((r) => toContact(r as Record<string, unknown>));
}

export async function getContact(id: string): Promise<Contact | null> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: `SELECT ${COLS} ${FROM} WHERE c.id = ?`, args: [id] });
  return res.rows[0] ? toContact(res.rows[0] as Record<string, unknown>) : null;
}

/** Distinct categories and cities for the filter menus. */
export async function facets(): Promise<{ types: string[]; cities: string[] }> {
  await ensureCrmSchema();
  const [t, c] = await Promise.all([
    db().execute("SELECT DISTINCT type FROM crm_contacts WHERE archived = 0 AND type IS NOT NULL AND type <> '' ORDER BY type LIMIT 200"),
    db().execute("SELECT DISTINCT city FROM crm_contacts WHERE archived = 0 AND city IS NOT NULL AND city <> '' ORDER BY city COLLATE NOCASE LIMIT 300"),
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

/** Ingest one prospect from the external assistant: dedupe, insert as source 'radar', optional draft. */
export async function ingestContact(c: IngestContact): Promise<{ id: string; duplicate: boolean }> {
  const r = await createContact({
    businessName: c.business_name, type: c.type, contactName: c.contact_name, email: c.email || null, phone: c.phone, website: c.website,
    address: c.address, city: c.city, region: c.region, source: "radar", score: c.score ?? null, scoreReasons: c.score_reasons ?? null, notes: c.notes,
  }, null);
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

export type DueAction = { id: string; businessName: string; nextAction: string | null; nextActionAt: string; stage: Stage; ownerName: string | null };
/** Open contacts whose next action is due today or earlier (Rome date). ownerId null = everyone's. */
export async function dueActions(ownerId: string | null, today: string): Promise<DueAction[]> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `SELECT c.id, c.business_name, c.next_action, c.next_action_at, c.stage, u.name AS owner_name ${FROM}
      WHERE c.archived = 0 AND c.stage NOT IN ('vinto','perso') AND c.next_action_at IS NOT NULL AND substr(c.next_action_at, 1, 10) <= ?
      ${ownerId ? "AND (c.owner_user_id = ? OR (c.owner_user_id IS NULL AND c.created_by = ?))" : ""} ORDER BY c.next_action_at LIMIT 50`,
    args: ownerId ? [today, ownerId, ownerId] : [today],
  });
  return res.rows.map((r) => ({ id: String(r.id), businessName: String(r.business_name), nextAction: s(r.next_action), nextActionAt: String(r.next_action_at), stage: isStage(r.stage) ? r.stage : "nuovo", ownerName: s(r.owner_name) }));
}

/** Active team members for the owner select. */
export async function crmOwners(): Promise<{ id: string; name: string }[]> {
  const r = await db().execute(`SELECT id, name FROM admin_users WHERE ${CAN_SIGN_IN_SQL} ORDER BY name`);
  return r.rows.map((x) => ({ id: String(x.id), name: String(x.name) }));
}
