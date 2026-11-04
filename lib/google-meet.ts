import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret, deriveKey, encryptSecret } from "@/lib/totp-core";

/*
 * Google Meet through the Google Calendar API (free). One agency Google account, connected once by a founder via
 * OAuth (server-side code flow with PKCE, offline access). Only the refresh token is stored, AES-256-GCM encrypted
 * with a key derived (HKDF) from SESSION_SECRET under its own label; access tokens live in memory for ~1 hour.
 * Scope: calendar.events only (create, list and delete events; Meet links come from conferenceData).
 */

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const MEET_TZ = "Europe/Rome";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const ROW = "agency";
const AAD = "google_oauth:agency";

export const googleConfigured = () => Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
export const redirectUri = () => process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "https://www.ctrlagency.dev/admin/riunioni/oauth";

const tokenKey = () => {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET missing");
  return deriveKey(s, "ctrl-google-oauth-v1");
};

export async function ensureMeetSchema() {
  await db().execute(`CREATE TABLE IF NOT EXISTS google_oauth (
    id TEXT PRIMARY KEY, refresh_enc TEXT NOT NULL, scope TEXT NOT NULL,
    connected_by TEXT, connected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
}

export function authorizeUrl(state: string, challenge: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(), redirect_uri: redirectUri(), response_type: "code", scope: GOOGLE_SCOPE,
    access_type: "offline", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${q}`;
}

export class GoogleError extends Error {
  kind: "disconnected" | "api";
  constructor(kind: "disconnected" | "api", message: string) { super(message); this.kind = kind; }
}

/** Exchanges the OAuth code and stores the refresh token encrypted. Throws if Google gave no refresh token or a wider/narrower scope. */
export async function completeConnect(code: string, verifier: string, founderId: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, code_verifier: verifier, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(), redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || typeof j.refresh_token !== "string") throw new GoogleError("api", "Google non ha restituito un accesso permanente. Riprova.");
  if (!String(j.scope ?? "").split(" ").includes(GOOGLE_SCOPE)) throw new GoogleError("api", "Permesso Calendar non concesso. Riprova e spunta l'accesso al calendario.");
  await ensureMeetSchema();
  const enc = encryptSecret(tokenKey(), Buffer.from(j.refresh_token, "utf8"), AAD);
  await db().execute({
    sql: "INSERT INTO google_oauth (id, refresh_enc, scope, connected_by) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET refresh_enc = excluded.refresh_enc, scope = excluded.scope, connected_by = excluded.connected_by, connected_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    args: [ROW, enc, GOOGLE_SCOPE, founderId],
  });
  cached = typeof j.access_token === "string" ? { token: j.access_token, until: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 } : null;
}

export type Connection = { connectedAt: string; connectedBy: string | null } | null;
export async function connection(): Promise<Connection> {
  await ensureMeetSchema();
  const r = (await db().execute({ sql: "SELECT g.connected_at, u.name FROM google_oauth g LEFT JOIN admin_users u ON u.id = g.connected_by WHERE g.id = ?", args: [ROW] })).rows[0];
  return r ? { connectedAt: String(r.connected_at), connectedBy: r.name ? String(r.name) : null } : null;
}

async function refreshToken(): Promise<string | null> {
  await ensureMeetSchema();
  const r = (await db().execute({ sql: "SELECT refresh_enc FROM google_oauth WHERE id = ?", args: [ROW] })).rows[0];
  return r ? decryptSecret(tokenKey(), String(r.refresh_enc), AAD).toString("utf8") : null;
}

let cached: { token: string; until: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const rt = await refreshToken();
  if (!rt) throw new GoogleError("disconnected", "Account Google non collegato.");
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(), refresh_token: rt, grant_type: "refresh_token" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Revoked or expired consent: forget the dead token so the page shows the setup card again.
    if (j.error === "invalid_grant") { await db().execute({ sql: "DELETE FROM google_oauth WHERE id = ?", args: [ROW] }); cached = null; throw new GoogleError("disconnected", "Accesso Google revocato: ricollega l'account."); }
    throw new GoogleError("api", "Google non risponde. Riprova tra poco.");
  }
  cached = { token: String(j.access_token), until: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
  return cached.token;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, { ...init, headers: { ...init.headers, authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" } });
  if (res.status === 401) { cached = null; throw new GoogleError("api", "Sessione Google scaduta. Riprova."); }
  if (!res.ok && !(init.method === "DELETE" && res.status === 410)) throw new GoogleError("api", `Google Calendar ha risposto ${res.status}.`);
  return res.status === 204 || init.method === "DELETE" ? null : res.json();
}

export type Meeting = { id: string; title: string; start: string; end: string; meetUrl: string | null; calendarUrl: string | null; attendees: string[]; notes: string };

const toMeeting = (e: Record<string, unknown> & { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: { email?: string }[] }): Meeting => ({
  id: String(e.id), title: String(e.summary ?? "Riunione"),
  start: String(e.start?.dateTime ?? e.start?.date ?? ""), end: String(e.end?.dateTime ?? e.end?.date ?? ""),
  meetUrl: typeof e.hangoutLink === "string" && e.hangoutLink.startsWith("https://meet.google.com/") ? e.hangoutLink : null,
  calendarUrl: typeof e.htmlLink === "string" && e.htmlLink.startsWith("https://") ? e.htmlLink : null,
  attendees: (e.attendees ?? []).map((a) => String(a.email ?? "")).filter(Boolean), notes: String(e.description ?? ""),
});

/** Local wall time "YYYY-MM-DDTHH:MM" in Europe/Rome, plus minutes. Google resolves the offset from timeZone. */
export function addMinutes(local: string, minutes: number) {
  const d = new Date(`${local}:00Z`); d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}
export const nowLocal = (now = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: MEET_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

export type NewMeeting = { title: string; start: string; minutes: number; attendees: string[]; notes: string; tag?: "client"; notify?: boolean };

/** Creates the Calendar event with a Meet link; Google emails the invitation to every attendee (sendUpdates=all). */
export async function createMeeting(m: NewMeeting): Promise<Meeting> {
  const body = {
    summary: m.title, description: m.notes || undefined,
    start: { dateTime: `${m.start}:00`, timeZone: MEET_TZ }, end: { dateTime: `${addMinutes(m.start, m.minutes)}:00`, timeZone: MEET_TZ },
    attendees: m.attendees.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
    extendedProperties: { private: m.tag ? { ctrl_client: "1" } : { ctrl: "1" } },
    guestsCanModify: false,
  };
  return toMeeting(await api(`?conferenceDataVersion=1&sendUpdates=${m.notify === false ? "none" : "all"}`, { method: "POST", body: JSON.stringify(body) }));
}

/** Upcoming meetings created from this panel (tagged ctrl=1), soonest first. */
export async function upcomingMeetings(now = new Date()): Promise<Meeting[]> {
  const q = new URLSearchParams({ timeMin: new Date(now.getTime() - 3600_000).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "25", privateExtendedProperty: "ctrl=1" });
  const j = await api(`?${q}`);
  return ((j?.items ?? []) as Parameters<typeof toMeeting>[0][]).filter((e) => e.status !== "cancelled").map(toMeeting);
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  if (!/^[a-zA-Z0-9_-]{5,200}$/.test(id)) return null;
  try { return toMeeting(await api(`/${id}`)); } catch { return null; }
}

/** Cancels the event and tells every attendee (Google sends the cancellation). */
export async function cancelMeeting(id: string, notify = true) {
  if (!/^[a-zA-Z0-9_-]{5,200}$/.test(id)) throw new GoogleError("api", "Riunione non valida.");
  await api(`/${id}?sendUpdates=${notify ? "all" : "none"}`, { method: "DELETE" });
}

/** Revokes the grant at Google (best effort) and deletes the stored token. */
export async function disconnect() {
  const rt = await refreshToken().catch(() => null);
  if (rt) await fetch(REVOKE_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: rt }) }).catch(() => {});
  await db().execute({ sql: "DELETE FROM google_oauth WHERE id = ?", args: [ROW] });
  cached = null;
}

export const EMAIL_RE = /^[^\s@<>(),;:"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export function parseEmails(raw: string): { ok: string[]; bad: string[] } {
  const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { ok: [...new Set(parts.filter((p) => EMAIL_RE.test(p)))], bad: parts.filter((p) => !EMAIL_RE.test(p)) };
}
