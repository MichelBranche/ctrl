import "server-only";
import { after } from "next/server";
import { romeDay } from "@/lib/crm-kpi";
import { db } from "@/lib/db";
import { discordEnabled, recordAdminNotice } from "@/lib/discord-notify";
import { ensureCrmSchema } from "@/lib/migrate";
import {
  IRIS_RECENT_MS, IRIS_STALE_MS, irisNoticeText, irisParamsSchema, irisStatusSchema, irisTransition, irisWebhookBody, irisWebhookHeaders,
  isIrisStatus, romeClock, type IrisNotice, type IrisParams, type IrisPhase, type IrisStatus,
} from "@/lib/crm-iris-core";

export type IrisResult = { ok: true; id: string } | { ok: false; status: number; error: string };

const ACTIVE = "('queued','working')";
const iso = (d: Date) => d.toISOString();

type Row = {
  id: string; requested_by: string; name: string | null; day_rome: string; params: string; status: string;
  inserted: number | null; duplicates: number | null; error_message: string | null; created_at: string; updated_at: string;
};

function mapRow(r: Record<string, unknown>): Row {
  return {
    id: String(r.id), requested_by: String(r.requested_by), name: r.name ? String(r.name) : null, day_rome: String(r.day_rome),
    params: String(r.params), status: String(r.status),
    inserted: r.inserted === null || r.inserted === undefined ? null : Number(r.inserted),
    duplicates: r.duplicates === null || r.duplicates === undefined ? null : Number(r.duplicates),
    error_message: r.error_message ? String(r.error_message) : null,
    created_at: String(r.created_at), updated_at: String(r.updated_at),
  };
}

function readParams(raw: string): IrisParams | null {
  try {
    const parsed = irisParamsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const SELECT = `SELECT r.id, r.requested_by, u.name AS name, r.day_rome, r.params, r.status, r.inserted, r.duplicates, r.error_message, r.created_at, r.updated_at
  FROM crm_iris_requests r LEFT JOIN admin_users u ON u.id = r.requested_by`;

async function load(id: string): Promise<Row | null> {
  const res = await db().execute({ sql: `${SELECT} WHERE r.id = ?`, args: [id] });
  return res.rows[0] ? mapRow(res.rows[0] as Record<string, unknown>) : null;
}

function phaseOf(row: Row, now: Date): IrisPhase | "error" {
  if (row.status === "ready") return "ready";
  if (row.status === "error") return "error";
  if (!isIrisStatus(row.status)) return "error";
  return now.getTime() - Date.parse(row.created_at) > IRIS_STALE_MS ? "expired" : row.status;
}

function toNotice(row: Row, now: Date): IrisNotice | null {
  const params = readParams(row.params);
  const phase = phaseOf(row, now);
  if (!params || phase === "error") return null;
  return {
    id: row.id,
    name: row.name?.trim() || "un founder",
    time: romeClock(row.created_at),
    zone: params.zone,
    sectors: params.sectors,
    phase,
    inserted: row.inserted ?? 0,
    blocked: phase === "queued" || phase === "working",
  };
}

/** The request the Radar should warn about, if one is still relevant. */
export async function currentIrisNotice(now = new Date()): Promise<IrisNotice | null> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `${SELECT} WHERE r.status IN ('queued','working','ready') ORDER BY r.created_at DESC LIMIT 30`,
    args: [],
  });
  const rows = res.rows.map((r) => mapRow(r as Record<string, unknown>));
  const age = (isoTime: string) => now.getTime() - Date.parse(isoTime);
  const active = rows.find((r) => (r.status === "queued" || r.status === "working") && age(r.created_at) <= IRIS_STALE_MS);
  if (active) return toNotice(active, now);
  const ready = rows.find((r) => r.status === "ready" && age(r.updated_at) <= IRIS_RECENT_MS);
  if (ready) return toNotice(ready, now);
  const stale = rows.find((r) => (r.status === "queued" || r.status === "working") && age(r.created_at) > IRIS_STALE_MS && age(r.created_at) <= IRIS_RECENT_MS);
  return stale ? toNotice(stale, now) : null;
}

export type IrisHistoryItem = {
  id: string; name: string; zone: string; sectors: string[]; phase: IrisPhase | "error";
  inserted: number | null; duplicates: number | null; error: string | null; createdAt: string;
};

export async function listIrisRequests(limit = 20, now = new Date()): Promise<IrisHistoryItem[]> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: `${SELECT} ORDER BY r.created_at DESC LIMIT ?`, args: [Math.min(50, Math.max(1, limit))] });
  return res.rows.map((raw) => {
    const row = mapRow(raw as Record<string, unknown>);
    const params = readParams(row.params);
    return {
      id: row.id, name: row.name?.trim() || "un founder", zone: params?.zone ?? "", sectors: params?.sectors ?? [],
      phase: phaseOf(row, now), inserted: row.inserted, duplicates: row.duplicates, error: row.error_message, createdAt: row.created_at,
    };
  });
}

export async function irisRequestExists(id: string): Promise<boolean> {
  await ensureCrmSchema();
  const res = await db().execute({ sql: "SELECT 1 FROM crm_iris_requests WHERE id = ?", args: [id] });
  return res.rows.length > 0;
}

const BLOCKED = "C'è già una ricerca in coda o in lavorazione. Attendi che finisca, oppure che siano passate 3 ore.";
const DAILY = "Hai già chiesto una ricerca oggi. Il prossimo tentativo è disponibile da domani.";

/**
 * One request per founder per Rome day, and one active request for the whole agency.
 * A request stuck in queued/working for more than 3 hours no longer holds either lock.
 * The day's credit comes back when the row is marked error.
 */
export async function requestIrisSearch(input: {
  userId: string; name: string; founder: boolean; params: unknown; now?: Date; origin: string;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<IrisResult> {
  if (!input.founder) return { ok: false, status: 403, error: "Solo i founder possono chiedere una ricerca a Iris." };
  const parsed = irisParamsSchema.safeParse(input.params);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Controlla i campi della richiesta.";
    return { ok: false, status: 400, error: message };
  }
  const now = input.now ?? new Date();
  const createdAt = iso(now);
  const day = romeDay(now);
  const freshAfter = iso(new Date(now.getTime() - IRIS_STALE_MS));
  const id = crypto.randomUUID();
  await ensureCrmSchema();
  const tx = await db().transaction("write");
  try {
    const active = await tx.execute({
      sql: `SELECT id FROM crm_iris_requests WHERE status IN ${ACTIVE} AND created_at >= ? LIMIT 1`,
      args: [freshAfter],
    });
    if (active.rows.length) return { ok: false, status: 409, error: BLOCKED };
    const mine = await tx.execute({
      sql: `SELECT id FROM crm_iris_requests WHERE requested_by = ? AND day_rome = ? AND status != 'error'
        AND NOT (status IN ${ACTIVE} AND created_at < ?) LIMIT 1`,
      args: [input.userId, day, freshAfter],
    });
    if (mine.rows.length) return { ok: false, status: 429, error: DAILY };
    await tx.execute({
      sql: `INSERT INTO crm_iris_requests (id, requested_by, day_rome, params, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
      args: [id, input.userId, day, JSON.stringify(parsed.data), createdAt, createdAt],
    });
    await tx.commit();
  } finally {
    tx.close();
  }

  const sent = await dispatchIris({ id, userId: input.userId, name: input.name, params: parsed.data, createdAt, origin: input.origin, fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
  if (!sent.ok) {
    await markError(id, sent.error);
    return { ok: false, status: 502, error: sent.error };
  }
  return { ok: true, id };
}

async function markError(id: string, message: string) {
  await db().execute({
    sql: `UPDATE crm_iris_requests SET status = 'error', error_message = ?, updated_at = ? WHERE id = ? AND status = 'queued'`,
    args: [message.slice(0, 1000), iso(new Date()), id],
  });
}

async function dispatchIris(input: {
  id: string; userId: string; name: string; params: IrisParams; createdAt: string; origin: string;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.CRM_IRIS_WEBHOOK_URL?.trim();
  const key = process.env.CRM_IRIS_WEBHOOK_KEY?.trim();
  const headers = url && key ? irisWebhookHeaders(key, process.env.CRM_IRIS_WEBHOOK_HEADER) : null;
  if (!url || !key || !headers) return { ok: false, error: "Il collegamento con Iris non è configurato. La richiesta è stata annullata e puoi riprovare." };
  const body = irisWebhookBody(input);
  const timeoutMs = input.timeoutMs ?? 8000;
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: "Iris non ha accettato la richiesta. Il tentativo è stato annullato e puoi riprovare." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Iris non ha risposto in tempo. Il tentativo è stato annullato e puoi riprovare." };
  }
}

/** Iris callback. Same bearer as /api/crm/ingest. Forward transitions only; repeating the current status is a no-op success. */
export async function applyIrisStatus(id: string, body: unknown, now = new Date()): Promise<IrisResult> {
  const parsed = irisStatusSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: "dati non validi" };
  await ensureCrmSchema();
  const row = await load(id);
  if (!row || !isIrisStatus(row.status)) return { ok: false, status: 404, error: "richiesta sconosciuta" };
  const step = irisTransition(row.status, parsed.data.status);
  if (step === "reject") return { ok: false, status: 409, error: "transizione non valida" };
  const next = parsed.data;
  const errorMessage = next.status === "error" ? (next.error_message?.trim() || "Iris ha segnalato un errore.") : null;
  const updated = await db().execute({
    sql: `UPDATE crm_iris_requests SET status = ?, inserted = COALESCE(?, inserted), duplicates = COALESCE(?, duplicates),
      error_message = CASE WHEN ? = 'error' THEN ? ELSE error_message END, updated_at = ? WHERE id = ? AND status = ?`,
    args: [next.status, next.inserted ?? null, next.duplicates ?? null, next.status, errorMessage, iso(now), id, row.status],
  });
  if (!updated.rowsAffected && step === "ok") return { ok: false, status: 409, error: "transizione non valida" };
  if (discordEnabled() && step === "ok" && updated.rowsAffected) {
    const notice = () => recordAdminNotice({
      id: `iris:${id}:${next.status}`,
      kind: "iris",
      event: "Stato richiesta Iris",
      title: irisNoticeTitle(next),
      actor: "Iris",
      href: `/admin/crm/radar?iris=${id}`,
    });
    try { after(notice); } catch { await notice(); }
  }
  return { ok: true, id };
}

function irisNoticeTitle(next: { status: "working" | "ready" | "error"; inserted?: number }): string {
  const status = irisStatusLabel(next.status);
  return status === "pronta" && typeof next.inserted === "number" ? `${status}, ${next.inserted} nuovi` : status;
}

function irisStatusLabel(status: "working" | "ready" | "error"): string {
  switch (status) {
    case "working": return "in lavorazione";
    case "ready": return "pronta";
    case "error": return "errore";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export { irisNoticeText };
