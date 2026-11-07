import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { logAction } from "@/lib/audit";
import { normEmail } from "@/lib/crm-core";
import { contactEmailPath } from "@/lib/crm-nav";
import type { OutreachContactWarning, OutreachReason, OutreachWarning } from "@/lib/crm-outreach-types";
import { db } from "@/lib/db";
import { parseRecipients } from "@/lib/mail/recipients";
import { ensureCrmSchema } from "@/lib/migrate";
import { canAccess, type Perms } from "@/lib/team-types";

/**
 * CRM outreach guard: the ONE domain check every app path that emails people must use (Posta/CRM composer via
 * sendMail, Radar drafts via sendDraftAction; reuse it for any new sender).
 *
 * Contract:
 *   const gate = await beginOutreach(me, recipients, ackFromClient);
 *   if (gate.kind === "warn") -> show gate.warning (in-app dialog), send nothing;
 *   if (gate.kind === "busy") -> show gate.message, send nothing;
 *   try { await provider.send(...) } catch (e) { await finishOutreach(gate.lease, sendOutcome(e)); ... }
 *   await finishOutreach(gate.lease, "sent")   // records the send, auto-assigns contacts without owner,
 *                                            // and moves a contact still at Nuovo to Contattato
 *
 * Invariants:
 * - Contacts are matched ONLY by the exact normalized recipient address (crm_contacts.email_norm, To + Cc), never by
 *   name, subject or domain. Archived contacts are ignored.
 * - A short lease per contact (crm_outreach.lease_*) is taken atomically (conditional UPSERT) before the state is
 *   read and before SMTP, so two concurrent sends to the same contact cannot both reach the provider.
 * - The consent ("Continua comunque") is an HMAC over the user id and every matched contact's fingerprint (owner,
 *   last send, uncertain outcome, contacted). Any change in between invalidates it; a client boolean is never trusted.
 * - The owner is set only after a real success and only where none exists (UPDATE … WHERE owner_user_id IS NULL,
 *   bumping `version` like every contact write, so open panels get the usual conflict instead of a lost update).
 *   Never overwrites. Senders without CRM access are never assigned (owner must be a CRM member).
 * - The same success moves stage only from Nuovo to Contattato, in the same write, and only while the row is still
 *   Nuovo at commit time. Call, Preventivo, Vinto, Perso and an already Contattato row stay. It never inserts an
 *   opportunity. A warning, a cancel, a definite failure and an uncertain outcome do not move the stage.
 * - Failed sends release the lease and change nothing else. Unknown outcomes are recorded as "uncertain" and require a
 *   new informed consent (no blind retry). SMTP cannot be exactly-once: this prevents app-side duplicates only.
 * - People with Email but without CRM get a generic notice: no contact names, owners, ids or links.
 */

export type OutreachActor = Perms & { id: string; name: string; email: string };
export type OutreachLease = { token: string; contactIds: string[]; actor: OutreachActor };
export type OutreachGate =
  | { kind: "clear"; lease: OutreachLease }
  | { kind: "warn"; warning: OutreachWarning }
  | { kind: "busy"; message: string };
export type SendOutcome = "sent" | "failed" | "uncertain";

/** Longer than the worst SMTP path (Resend 8+6+20 s, then Gmail 8+6+20 s, plus attachment fetch). */
export const LEASE_SECONDS = 180;
export const RECENT_ANY_MS = 24 * 3600_000;
export const RECENT_COLLEAGUE_MS = 14 * 24 * 3600_000;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const ACK = /^[A-Za-z0-9_-]{43}$/;

type StateRow = {
  id: string; name: string; stage: string; ownerId: string | null; ownerName: string | null; ownerActive: boolean | null;
  lastSentAt: string | null; lastSentBy: string | null; lastSentByName: string | null; uncertainAt: string | null;
  leaseUser: string | null; leaseUserName: string | null; leased: boolean;
};

const STATE_SQL = (marks: string) => `SELECT c.id, c.business_name, c.stage, c.owner_user_id, u.name AS owner_name,
  CASE WHEN c.owner_user_id IS NULL THEN NULL WHEN u.id IS NOT NULL AND u.active = 1 AND u.invite_state IS NULL AND u.removed_at IS NULL THEN 1 ELSE 0 END AS owner_active,
  o.last_sent_at, o.last_sent_by, ls.name AS last_sent_by_name, o.uncertain_at, o.lease_user, lu.name AS lease_user_name,
  CASE WHEN o.lease_until IS NOT NULL AND o.lease_until > ${NOW} THEN 1 ELSE 0 END AS leased
  FROM crm_contacts c LEFT JOIN admin_users u ON u.id = c.owner_user_id LEFT JOIN crm_outreach o ON o.contact_id = c.id
  LEFT JOIN admin_users ls ON ls.id = o.last_sent_by LEFT JOIN admin_users lu ON lu.id = o.lease_user
  WHERE c.archived = 0 AND c.id IN (${marks}) ORDER BY c.id`;

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const toRow = (r: Record<string, unknown>): StateRow => ({
  id: String(r.id), name: String(r.business_name), stage: String(r.stage), ownerId: str(r.owner_user_id), ownerName: str(r.owner_name),
  ownerActive: r.owner_active === null || r.owner_active === undefined ? null : Number(r.owner_active) === 1,
  lastSentAt: str(r.last_sent_at), lastSentBy: str(r.last_sent_by), lastSentByName: str(r.last_sent_by_name), uncertainAt: str(r.uncertain_at),
  leaseUser: str(r.lease_user), leaseUserName: str(r.lease_user_name), leased: Number(r.leased) === 1,
});

/** Distinct exact normalized addresses; malformed ones simply match nothing. */
const normalized = (recipients: readonly string[]) => [...new Set(recipients.map(normEmail).filter((a) => a.includes("@") && a.length <= 254))].slice(0, 50);

/** Ids of open contacts whose email is exactly one of the recipients. */
export async function contactsForRecipients(recipients: readonly string[]): Promise<string[]> {
  const addresses = normalized(recipients);
  if (!addresses.length) return [];
  await ensureCrmSchema();
  const marks = addresses.map(() => "?").join(",");
  // email_norm is set by every app write; rows imported without it still match on their exact trimmed, lowercased email.
  const r = await db().execute({ sql: `SELECT id FROM crm_contacts WHERE archived = 0 AND (email_norm IN (${marks}) OR (email_norm = '' AND lower(trim(email)) IN (${marks}))) ORDER BY id`, args: [...addresses, ...addresses] });
  return r.rows.map((x) => String(x.id));
}

async function readState(ids: string[]): Promise<StateRow[]> {
  if (!ids.length) return [];
  const r = await db().execute({ sql: STATE_SQL(ids.map(() => "?").join(",")), args: ids });
  return r.rows.map((x) => toRow(x as Record<string, unknown>));
}

const contacted = (r: StateRow) => r.stage !== "nuovo" || Boolean(r.lastSentAt);
const fingerprint = (r: StateRow) => createHash("sha256").update([r.ownerId ?? "", r.lastSentAt ?? "", r.lastSentBy ?? "", r.uncertainAt ?? "", contacted(r) ? "1" : "0"].join("|")).digest("base64url");

export function reasonFor(r: StateRow, actorId: string, now = Date.now()): OutreachReason | null {
  if (r.uncertainAt) return "uncertain";
  if (r.ownerId && r.ownerId !== actorId) return "owner_other";
  if (!r.ownerId && contacted(r)) return "contacted_unassigned";
  const sent = r.lastSentAt ? Date.parse(r.lastSentAt) : Number.NaN;
  if (Number.isFinite(sent) && (now - sent < RECENT_ANY_MS || (r.lastSentBy !== actorId && now - sent < RECENT_COLLEAGUE_MS))) return "recent";
  return null;
}

function ackFor(actor: OutreachActor, rows: StateRow[]): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("SESSION_SECRET missing");
  return createHmac("sha256", secret).update(`crm-outreach-v1\n${actor.id}\n${rows.map((r) => `${r.id}:${fingerprint(r)}`).join(",")}`).digest("base64url");
}
const sameAck = (a: string | null | undefined, b: string) => Boolean(a && ACK.test(a)) && timingSafeEqual(Buffer.from(a!), Buffer.from(b));

function warningFor(actor: OutreachActor, rows: StateRow[], given: string | null | undefined): OutreachWarning | null {
  const flagged = rows.map((r) => ({ r, reason: reasonFor(r, actor.id) })).filter((x): x is { r: StateRow; reason: OutreachReason } => x.reason !== null);
  if (!flagged.length) return null;
  const ack = ackFor(actor, rows);
  if (sameAck(given, ack)) return null;
  const crm = canAccess(actor, "crm");
  const contacts: OutreachContactWarning[] = crm ? flagged.map(({ r, reason }) => ({
    id: r.id, name: r.name, reason, ownerName: r.ownerName, ownerActive: r.ownerActive,
    lastSentAt: r.lastSentAt, lastSentByName: r.lastSentBy === actor.id ? "te" : r.lastSentByName, mailHref: contactEmailPath(r.id),
  })) : [];
  return { contacts, generic: !crm, ack, updated: Boolean(given) };
}

/** Read-only: the warning to show when a composer opens (no lease). null when nothing to say. */
export async function outreachWarning(actor: OutreachActor, recipients: readonly string[]): Promise<OutreachWarning | null> {
  const ids = await contactsForRecipients(recipients);
  return ids.length ? warningFor(actor, await readState(ids), null) : null;
}

/** Composer opening (To/Cc as typed or prefilled). Fails open: the send-time check is the authoritative one. */
export async function composeOutreach(actor: OutreachActor, to: string, cc: string): Promise<OutreachWarning | null> {
  try { return await outreachWarning(actor, [...parseRecipients(to), ...parseRecipients(cc)]); }
  catch { return null; }
}

/**
 * Call right before the provider send. Takes the leases atomically, then re-reads the state inside the same write
 * transaction and checks the consent against it. Releases everything itself unless it returns "clear".
 */
export async function beginOutreach(actor: OutreachActor, recipients: readonly string[], ack: string | null | undefined): Promise<OutreachGate> {
  const ids = await contactsForRecipients(recipients);
  const token = randomUUID();
  const lease: OutreachLease = { token, contactIds: [], actor };
  if (!ids.length) return { kind: "clear", lease };
  const marks = ids.map(() => "?").join(",");
  const results = await db().batch([
    ...ids.map((id) => ({
      sql: `INSERT INTO crm_outreach (contact_id, lease_token, lease_user, lease_until) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now','+${LEASE_SECONDS} seconds'))
        ON CONFLICT(contact_id) DO UPDATE SET lease_token = excluded.lease_token, lease_user = excluded.lease_user, lease_until = excluded.lease_until
        WHERE crm_outreach.lease_until IS NULL OR crm_outreach.lease_until <= ${NOW}`,
      args: [id, token, actor.id],
    })),
    { sql: STATE_SQL(marks), args: ids },
  ], "write");
  const taken = ids.filter((_, i) => results[i].rowsAffected > 0);
  lease.contactIds = taken;
  const rows = results[ids.length].rows.map((x) => toRow(x as Record<string, unknown>));
  const blocked = rows.find((r) => !taken.includes(r.id));
  if (blocked) {
    await release(lease);
    const crm = canAccess(actor, "crm");
    return {
      kind: "busy",
      message: blocked.leaseUser === actor.id
        ? "Hai già un invio in corso verso questo destinatario: attendi l'esito prima di riprovare."
        : crm
          ? `${blocked.leaseUserName ?? "Un collega"} sta inviando proprio ora un'email a ${blocked.name}. Attendi qualche secondo e riprova: vedrai l'avviso aggiornato.`
          : "Un collega sta inviando proprio ora a uno di questi destinatari. Riprova tra poco.",
    };
  }
  const warning = warningFor(actor, rows, ack);
  if (warning) {
    await release(lease);
    return { kind: "warn", warning };
  }
  return { kind: "clear", lease };
}

async function release(lease: OutreachLease) {
  if (!lease.contactIds.length) return;
  await db().batch(lease.contactIds.map((id) => ({
    sql: "UPDATE crm_outreach SET lease_token = NULL, lease_user = NULL, lease_until = NULL WHERE contact_id = ? AND lease_token = ?",
    args: [id, lease.token],
  })), "write");
}

/**
 * Records the outcome. "sent": last send + auto-assign where no owner (never overwrites) + Nuovo becomes Contattato.
 * "failed": release only. "uncertain": flags the contact so the next writer must confirm again after checking Inviati.
 * `assigned` is who just became responsible. `advanced` is who moved from Nuovo to Contattato. Neither creates a deal.
 */
export async function finishOutreach(lease: OutreachLease, outcome: SendOutcome): Promise<{ assigned: string[]; advanced: string[] }> {
  const ids = lease.contactIds;
  const none = { assigned: [] as string[], advanced: [] as string[] };
  if (!ids.length) return none;
  if (outcome === "failed") { await release(lease); return none; }
  const clear = `lease_token = CASE WHEN lease_token = ? THEN NULL ELSE lease_token END, lease_user = CASE WHEN lease_token = ? THEN NULL ELSE lease_user END,
    lease_until = CASE WHEN lease_token = ? THEN NULL ELSE lease_until END`;
  if (outcome === "uncertain") {
    await db().batch(ids.map((id) => ({ sql: `UPDATE crm_outreach SET uncertain_at = ${NOW}, uncertain_by = ?, ${clear} WHERE contact_id = ?`, args: [lease.actor.id, lease.token, lease.token, lease.token, id] })), "write");
    return none;
  }
  const assign = canAccess(lease.actor, "crm");
  const results = await db().batch([
    ...ids.map((id) => ({ sql: `UPDATE crm_outreach SET last_sent_at = ${NOW}, last_sent_by = ?, uncertain_at = NULL, uncertain_by = NULL, ${clear} WHERE contact_id = ?`, args: [lease.actor.id, lease.token, lease.token, lease.token, id] })),
    ...(assign ? ids.map((id) => ({
      sql: `UPDATE crm_contacts SET owner_user_id = ?, version = version + 1, updated_at = ${NOW} WHERE id = ? AND archived = 0 AND owner_user_id IS NULL`,
      args: [lease.actor.id, id],
    })) : []),
    ...ids.map((id) => ({
      sql: `UPDATE crm_contacts SET stage = 'contattato', stage_changed_at = ${NOW}, version = version + 1, updated_at = ${NOW} WHERE id = ? AND archived = 0 AND stage = 'nuovo'`,
      args: [id],
    })),
  ], "write");
  const assigned = assign ? ids.filter((_, i) => results[ids.length + i].rowsAffected > 0) : [];
  const stageAt = ids.length + (assign ? ids.length : 0);
  const advanced = ids.filter((_, i) => results[stageAt + i].rowsAffected > 0);
  for (const id of assigned) await logAction("crm.owner", { type: "crm_contact", id }, { from: null, to: lease.actor.id, auto: "email" }, lease.actor);
  for (const id of advanced) await logAction("crm.stage", { type: "crm_contact", id }, { from: "nuovo", to: "contattato", auto: "email" }, lease.actor);
  return { assigned, advanced };
}

/** Provider errors that prove nothing left are "failed"; anything else may have been delivered. */
export function sendOutcome(error: unknown): Exclude<SendOutcome, "sent"> {
  // MailError kinds (lib/mail/provider.ts), read structurally so this module stays free of the provider runtime.
  const kind = error instanceof Error ? (error as Error & { kind?: unknown }).kind : undefined;
  return kind === "auth" || kind === "network" || kind === "notfound" || kind === "toolarge" ? "failed" : "uncertain";
}

export const UNCERTAIN_MESSAGE = "Esito dell'invio incerto: l'email potrebbe essere partita. Controlla in Posta › Inviati prima di riprovare.";
