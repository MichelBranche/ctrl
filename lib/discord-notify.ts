import "server-only";
import { after } from "next/server";
import { db, dbConfigured } from "@/lib/db";
import {
  auditActor, auditHref, auditTitle, discordPayload, discordWebhookUrl, kindFromAction, scrubDiscord,
  type NoticeDraft,
} from "@/lib/discord-core";
import { dedupeKeys } from "@/lib/crm-core";
import { romeDay } from "@/lib/crm-kpi";
import { ensureCrmSchema, ensureDiscordSchema } from "@/lib/migrate";

/**
 * Admin notices to a Discord channel. Missing DISCORD_WEBHOOK_URL disables the feature:
 * no row, no request, no error for the caller. Sends never throw.
 * The outbox is additive (db/018_discord_outbox.sql). Rollback: DROP TABLE discord_outbox.
 */

const BURST_MS_DEFAULT = 200;
const SEND_TIMEOUT_MS = 4_000;
const MAX_WAIT_MS = 5_000;
const MAX_BATCHES = 3;
const CLAIM_MS = 30_000;
const MAX_ATTEMPTS = 4;

export type AdminNotice = {
  id: string;
  kind: string;
  event: string;
  title: string;
  actor?: string | null;
  href: string;
};

type FlushOpts = { timeoutMs?: number; fetchImpl?: typeof fetch; now?: Date };

let tail: Promise<void> = Promise.resolve();
let burst: ReturnType<typeof setTimeout> | null = null;
let finishBurst: (() => void) | null = null;

function configured(): string | null {
  return discordWebhookUrl(process.env.DISCORD_WEBHOOK_URL);
}

/** False when the webhook is missing or not a Discord URL. Callers then skip every extra read. */
export function discordEnabled(): boolean {
  return configured() != null;
}

function burstMs(): number {
  // The test suite sets DISCORD_BURST_MS=0. Anywhere else the wait stays at 200ms, and never above 2s.
  const n = Number(process.env.DISCORD_BURST_MS);
  if (!Number.isFinite(n) || n < 0 || n > 2_000) return BURST_MS_DEFAULT;
  return n;
}

/** Resolves when a scheduled flush has finished. Tests await this; production uses after(). */
export function whenDiscordSettled(): Promise<void> {
  return tail;
}

/** One flush after a short quiet period, so a burst becomes a single webhook call. */
function scheduleDiscordFlush(): void {
  if (!configured()) return;
  if (!finishBurst) {
    const job = new Promise<void>((resolve) => { finishBurst = resolve; });
    tail = job;
    try { after(() => job); } catch { /* already deferred, or a test stub without after() */ }
  }
  if (burst) clearTimeout(burst);
  burst = setTimeout(() => {
    burst = null;
    const done = finishBurst;
    finishBurst = null;
    flushDiscord().finally(() => done?.());
  }, burstMs());
}

async function enqueue(notice: AdminNotice): Promise<void> {
  if (!configured() || !dbConfigured) return;
  const id = notice.id.trim().slice(0, 120);
  const event = scrubDiscord(notice.event).slice(0, 80);
  const title = scrubDiscord(notice.title);
  const actor = notice.actor ? scrubDiscord(notice.actor).slice(0, 80) : null;
  if (!id || !event || !title) return;
  await ensureDiscordSchema();
  await db().execute({
    sql: `INSERT OR IGNORE INTO discord_outbox (id, kind, event, title, actor, href, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, notice.kind.slice(0, 32), event, title, actor || null, notice.href.slice(0, 200), new Date().toISOString()],
  });
}

/** Queues one notice and flushes in the background. A duplicate id is ignored. */
export async function recordAdminNotice(notice: AdminNotice, opts?: { flush?: boolean }): Promise<void> {
  try {
    await enqueue(notice);
    if (opts?.flush !== false) scheduleDiscordFlush();
  } catch (error) {
    console.error("[discord] enqueue failed:", error instanceof Error ? error.message : error);
  }
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function contactName(id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    await ensureCrmSchema();
    const res = await db().execute({ sql: "SELECT business_name FROM crm_contacts WHERE id = ?", args: [id] });
    const name = res.rows[0]?.business_name;
    return typeof name === "string" && name ? name : null;
  } catch {
    return null;
  }
}

/** Called after a successful audit insert. Future logAction types are covered without a new hook. */
export async function recordAuditNotice(input: {
  id: number;
  action: string;
  label: string;
  targetType: string | null;
  targetId: string | null;
  actorName: string | null;
  details: string | null;
}): Promise<void> {
  if (!configured() || !input.id) return;
  const details = parseDetails(input.details);
  const name = input.targetType === "crm_contact" ? await contactName(input.targetId) : null;
  await recordAdminNotice({
    id: `audit:${input.id}`,
    kind: kindFromAction(input.action),
    event: input.label,
    title: auditTitle(input.action, details, name),
    actor: auditActor(input.action, input.actorName),
    href: auditHref(input.action, input.targetType, input.targetId),
  });
}

type MailHit = { key: string; uid: number; subject: string; fromName: string; fromAddress: string };

/** New unseen inbox messages. The address is used only to find a contact name and is not stored. */
export async function noticeInboxMail(items: MailHit[]): Promise<void> {
  if (!configured() || !items.length) return;
  try {
    await ensureCrmSchema();
    for (const item of items) {
      const key = item.key.trim();
      if (!/^[\da-f]{16,64}$/i.test(key)) continue;
      const email = dedupeKeys({ email: item.fromAddress }).email;
      let business: string | null = null;
      let contactId: string | null = null;
      if (email) {
        const res = await db().execute({
          sql: "SELECT id, business_name FROM crm_contacts WHERE email_norm = ? AND archived = 0 LIMIT 1",
          args: [email],
        });
        const row = res.rows[0];
        if (row) {
          contactId = String(row.id);
          business = typeof row.business_name === "string" ? row.business_name : null;
        }
      }
      const subject = item.subject.trim();
      const who = item.fromName.includes("@") ? "" : item.fromName.trim();
      const lead = Boolean(contactId && business);
      await recordAdminNotice({
        id: `mail:${key}`,
        kind: lead ? "lead_reply" : "email_in",
        event: lead ? "Risposta di un lead" : "Email in arrivo",
        title: [lead ? business : who, subject].filter(Boolean).join(" · ") || "Nuova email",
        actor: "Sistema",
        href: lead && contactId ? `/admin/crm/${contactId}` : Number.isInteger(item.uid) && item.uid > 0 ? `/admin/email?m=${item.uid}` : "/admin/email",
      });
    }
  } catch (error) {
    console.error("[discord] mail notice failed:", error instanceof Error ? error.message : error);
  }
}

async function collectDue(now: Date): Promise<void> {
  const day = romeDay(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  await ensureCrmSchema();
  const follows = await db().execute({
    sql: `SELECT id, business_name, next_action FROM crm_contacts
      WHERE archived = 0 AND stage NOT IN ('vinto','perso') AND next_action_at IS NOT NULL AND substr(next_action_at, 1, 10) = ?
      LIMIT 10`,
    args: [day],
  });
  for (const row of follows.rows) {
    const id = String(row.id);
    const name = String(row.business_name ?? "");
    const action = typeof row.next_action === "string" ? row.next_action : "";
    await enqueue({
      id: `due:followup:${id}:${day}`,
      kind: "followup",
      event: "Follow-up in scadenza",
      title: [name, action].filter(Boolean).join(" · ") || "Follow-up",
      actor: "Sistema",
      href: `/admin/crm/${id}`,
    });
  }
  const activities = await db().execute({
    sql: `SELECT a.id, a.title, a.kind, a.contact_id, c.business_name
      FROM crm_activities a LEFT JOIN crm_contacts c ON c.id = a.contact_id
      WHERE a.done_at IS NULL AND a.due_date = ? LIMIT 10`,
    args: [day],
  });
  for (const row of activities.rows) {
    const id = String(row.id);
    const contactId = typeof row.contact_id === "string" ? row.contact_id : "";
    const name = typeof row.business_name === "string" ? row.business_name : "";
    const title = typeof row.title === "string" ? row.title : "";
    const follow = row.kind === "followup";
    await enqueue({
      id: `due:activity:${id}:${day}`,
      kind: follow ? "followup" : "activity",
      event: follow ? "Follow-up in scadenza" : "Attività in scadenza",
      title: [name, title].filter(Boolean).join(" · ") || "Attività",
      actor: "Sistema",
      href: /^[A-Za-z0-9_-]{1,80}$/.test(contactId) ? `/admin/crm/${contactId}` : "/admin/crm/attivita",
    });
  }
}

type Pending = NoticeDraft & { id: string };

async function claim(now: Date): Promise<{ token: string; rows: Pending[] } | null> {
  const stale = new Date(now.getTime() - CLAIM_MS).toISOString();
  const token = crypto.randomUUID();
  const picked = await db().execute({
    sql: `SELECT id FROM discord_outbox
      WHERE sent_at IS NULL AND attempts < ? AND (claim IS NULL OR claim_at < ?)
      ORDER BY created_at LIMIT 10`,
    args: [MAX_ATTEMPTS, stale],
  });
  const ids = picked.rows.map((row) => String(row.id));
  if (!ids.length) return null;
  const updated = await db().execute({
    sql: `UPDATE discord_outbox SET claim = ?, claim_at = ?
      WHERE sent_at IS NULL AND attempts < ? AND (claim IS NULL OR claim_at < ?) AND id IN (${ids.map(() => "?").join(",")})`,
    args: [token, now.toISOString(), MAX_ATTEMPTS, stale, ...ids],
  });
  if (!updated.rowsAffected) return null;
  const mine = await db().execute({
    sql: "SELECT id, kind, event, title, actor, href, created_at FROM discord_outbox WHERE claim = ? ORDER BY created_at",
    args: [token],
  });
  const rows: Pending[] = mine.rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    event: String(row.event),
    title: String(row.title),
    actor: typeof row.actor === "string" ? row.actor : null,
    href: String(row.href),
    at: String(row.created_at),
  }));
  return rows.length ? { token, rows } : null;
}

async function markSending(token: string, at: string): Promise<void> {
  await db().execute({ sql: "UPDATE discord_outbox SET sent_at = ? WHERE claim = ?", args: [at, token] });
}

async function finish(token: string, sent: boolean): Promise<void> {
  if (sent) {
    await db().execute({ sql: "UPDATE discord_outbox SET claim = NULL, claim_at = NULL WHERE claim = ?", args: [token] });
    return;
  }
  await db().execute({
    sql: "UPDATE discord_outbox SET sent_at = NULL, claim = NULL, claim_at = NULL, attempts = attempts + 1 WHERE claim = ?",
    args: [token],
  });
}

function retryDelay(status: number, header: string | null, body: string): number | null {
  if (status !== 429) return null;
  let seconds = Number.NaN;
  try {
    const parsed = JSON.parse(body) as { retry_after?: unknown };
    seconds = Number(parsed.retry_after);
  } catch { /* header below */ }
  if (!Number.isFinite(seconds)) seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 1;
  return Math.min(MAX_WAIT_MS, Math.round(seconds * 1000));
}

async function postOnce(url: string, body: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<{ ok: boolean; retryMs: number | null }> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text().then((value) => value.slice(0, 400)).catch(() => "");
  if (res.ok) return { ok: true, retryMs: null };
  return { ok: false, retryMs: retryDelay(res.status, res.headers.get("retry-after"), text) };
}

/**
 * Sends pending notices, at most 10 embeds per message and 3 messages per call.
 * Groups whatever is waiting. Safe to call when the webhook is unset.
 */
export async function flushDiscord(opts: FlushOpts = {}): Promise<{ sent: number }> {
  const url = configured();
  if (!url || !dbConfigured) return { sent: 0 };
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? SEND_TIMEOUT_MS;
  let sent = 0;
  try {
    await ensureDiscordSchema();
    try { await collectDue(now); } catch (error) {
      console.error("[discord] due scan failed:", error instanceof Error ? error.message : error);
    }
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const claimed = await claim(now);
      if (!claimed) break;
      const body = JSON.stringify(discordPayload(claimed.rows));
      const at = now.toISOString();
      let delivered = false;
      try {
        // Marked before the request: a crash after Discord accepts it cannot send the same notice again.
        await markSending(claimed.token, at);
        let result = await postOnce(url, body, timeoutMs, fetchImpl);
        if (!result.ok && result.retryMs != null) {
          await db().execute({ sql: "UPDATE discord_outbox SET sent_at = NULL WHERE claim = ?", args: [claimed.token] });
          await new Promise((resolve) => setTimeout(resolve, result.retryMs ?? 0));
          await markSending(claimed.token, at);
          result = await postOnce(url, body, timeoutMs, fetchImpl);
        }
        delivered = result.ok;
        if (!delivered) console.error("[discord] send failed");
      } catch (error) {
        console.error("[discord] send failed:", error instanceof Error ? error.message : error);
      }
      await finish(claimed.token, delivered);
      if (!delivered) break;
      sent += claimed.rows.length;
    }
  } catch (error) {
    console.error("[discord] flush failed:", error instanceof Error ? error.message : error);
  }
  return { sent };
}
