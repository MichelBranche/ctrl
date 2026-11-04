/*
 * Google Meet (Calendar API) self-test, no network: Google is a mocked fetch, the DB is temp SQLite.
 *   node scripts/meet-test.mjs
 * Checks the "meetings" permission, the OAuth URL and state cookie, the encrypted refresh token, the event body
 * (Meet link request, invites to everyone, Rome timezone), listing/cancel, and that a revoked grant disconnects.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-meet-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
process.env.GOOGLE_OAUTH_CLIENT_ID = "cid.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript,export async function headers(){return new Headers()}export async function cookies(){return{get(){},set(){},delete(){}}}", shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

// Mocked Google: records every call, answers from `route`.
const calls = [];
let route = () => new Response("{}", { status: 404 });
globalThis.fetch = async (url, init = {}) => { const c = { url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body }; calls.push(c); return route(c); };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

try {
  const T = await import("../lib/team-types.ts");
  for (const r of ["project_manager", "commerciale", "assistenza", "founder"]) assert.ok(T.canAccess({ roles: [r] }, "meetings"), r);
  for (const r of ["designer", "esterno", "seo"]) assert.ok(!T.canAccess({ roles: [r] }, "meetings"), r);
  assert.equal(T.SECTION_HREF.meetings, "/admin/riunioni");
  console.log("ok permissions");

  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  await (await import("../lib/migrate.ts")).ensureTeamSchema();
  await db().execute("INSERT INTO admin_users (id, email, name, password_hash, role, active) VALUES ('f1','f@t.test','Fondatore Uno','x','founder',1)");
  const G = await import("../lib/google-meet.ts");
  const S = await import("../lib/google-oauth-state.ts");

  // OAuth URL: offline + consent, PKCE, only calendar.events.
  const st = await S.newOAuthState("f1");
  const u = new URL(G.authorizeUrl(st.state, st.challenge));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.events");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("redirect_uri"), "https://www.ctrlagency.dev/admin/riunioni/oauth");
  assert.equal(u.searchParams.get("state"), st.state);
  const verifier = await S.readOAuthState(st.cookie, st.state, "f1");
  assert.ok(verifier && verifier.length >= 43);
  assert.equal(await S.readOAuthState(st.cookie, "other-state", "f1"), null, "state mismatch");
  assert.equal(await S.readOAuthState(st.cookie, st.state, "m9"), null, "other user");
  assert.equal(await S.readOAuthState(st.cookie + "x", st.state, "f1"), null, "tampered cookie");
  console.log("ok oauth url + state");

  // Connect: a missing scope or refresh token is refused; success stores it encrypted.
  route = () => json({ access_token: "at-1", expires_in: 3600, refresh_token: "rt-SECRET", scope: "openid" });
  await assert.rejects(G.completeConnect("code", verifier, "f1"), /Permesso Calendar/);
  route = () => json({ access_token: "at-1", expires_in: 3600, scope: G.GOOGLE_SCOPE });
  await assert.rejects(G.completeConnect("code", verifier, "f1"), /accesso permanente/);
  assert.equal(await G.connection(), null);
  calls.length = 0;
  route = () => json({ access_token: "at-1", expires_in: 3600, refresh_token: "rt-SECRET", scope: G.GOOGLE_SCOPE });
  await G.completeConnect("code-1", verifier, "f1");
  const tok = new URLSearchParams(calls[0].body);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(tok.get("grant_type"), "authorization_code");
  assert.equal(tok.get("code_verifier"), verifier);
  const row = (await db().execute("SELECT * FROM google_oauth")).rows[0];
  assert.ok(!JSON.stringify(row).includes("rt-SECRET"), "refresh token not in plaintext");
  assert.match(String(row.refresh_enc), /^v1\./);
  const { deriveKey, decryptSecret } = await import("../lib/totp-core.ts");
  assert.throws(() => decryptSecret(deriveKey(process.env.SESSION_SECRET, "ctrl-totp-v1"), String(row.refresh_enc), "google_oauth:agency"), undefined, "distinct key label");
  assert.equal(decryptSecret(deriveKey(process.env.SESSION_SECRET, "ctrl-google-oauth-v1"), String(row.refresh_enc), "google_oauth:agency").toString(), "rt-SECRET");
  assert.equal((await G.connection()).connectedBy, "Fondatore Uno");
  console.log("ok connect stores encrypted token");

  // Create: Meet request, invites to all, Rome timezone, tagged for the list.
  calls.length = 0;
  route = (c) => json({ id: "evt12345", summary: "Kickoff", hangoutLink: "https://meet.google.com/abc-defg-hij", htmlLink: "https://calendar.google.com/x", start: { dateTime: "2026-11-05T10:00:00+01:00" }, end: { dateTime: "2026-11-05T10:45:00+01:00" }, attendees: JSON.parse(c.body).attendees });
  const m = await G.createMeeting({ title: "Kickoff", start: "2026-11-05T10:00", minutes: 45, attendees: ["f@t.test", "cliente@x.it"], notes: "Ordine del giorno" });
  assert.equal(calls.length, 1, "cached access token reused");
  const cu = new URL(calls[0].url);
  assert.equal(cu.pathname, "/calendar/v3/calendars/primary/events");
  assert.equal(cu.searchParams.get("conferenceDataVersion"), "1");
  assert.equal(cu.searchParams.get("sendUpdates"), "all");
  assert.equal(calls[0].headers.authorization, "Bearer at-1");
  const b = JSON.parse(calls[0].body);
  assert.equal(b.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.ok(b.conferenceData.createRequest.requestId.length >= 20);
  assert.deepEqual(b.start, { dateTime: "2026-11-05T10:00:00", timeZone: "Europe/Rome" });
  assert.deepEqual(b.end, { dateTime: "2026-11-05T10:45:00", timeZone: "Europe/Rome" });
  assert.deepEqual(b.attendees, [{ email: "f@t.test" }, { email: "cliente@x.it" }]);
  assert.equal(b.extendedProperties.private.ctrl, "1");
  assert.equal(b.description, "Ordine del giorno");
  assert.equal(m.meetUrl, "https://meet.google.com/abc-defg-hij");
  assert.equal(G.addMinutes("2026-11-05T23:45", 30), "2026-11-06T00:15");
  console.log("ok create meeting");

  // List: only panel events, cancelled dropped, non-Meet links ignored.
  calls.length = 0;
  route = () => json({ items: [
    { id: "evt1aaaa", summary: "A", status: "confirmed", hangoutLink: "https://meet.google.com/aaa-bbbb-ccc", start: { dateTime: "2026-11-05T10:00:00+01:00" }, end: { dateTime: "2026-11-05T10:30:00+01:00" } },
    { id: "evt2bbbb", summary: "B", status: "cancelled" },
    { id: "evt3cccc", summary: "C", status: "confirmed", hangoutLink: "https://evil.example/x", start: { dateTime: "2026-11-06T10:00:00+01:00" }, end: { dateTime: "2026-11-06T10:30:00+01:00" } },
  ] });
  const list = await G.upcomingMeetings();
  assert.deepEqual(list.map((x) => x.id), ["evt1aaaa", "evt3cccc"]);
  assert.equal(list[1].meetUrl, null);
  const lq = new URL(calls[0].url).searchParams;
  assert.equal(lq.get("privateExtendedProperty"), "ctrl=1");
  assert.equal(lq.get("singleEvents"), "true");
  assert.equal(lq.get("orderBy"), "startTime");

  calls.length = 0;
  route = () => new Response(null, { status: 204 });
  await G.cancelMeeting("evt1aaaa");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(new URL(calls[0].url).searchParams.get("sendUpdates"), "all");
  route = () => new Response(null, { status: 410 });
  await G.cancelMeeting("evt1aaaa");
  await assert.rejects(G.cancelMeeting("../x"), /non valida/);
  assert.equal(await G.getMeeting("a/b?c"), null);
  route = () => json({ error: { code: 500 } }, 500);
  await assert.rejects(G.upcomingMeetings(), (e) => e instanceof G.GoogleError && e.kind === "api");
  console.log("ok list + cancel");

  // Disconnect revokes and deletes; reconnect, then a revoked grant (invalid_grant) clears the row.
  calls.length = 0;
  route = () => json({});
  await G.disconnect();
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/revoke");
  assert.equal(new URLSearchParams(calls[0].body).get("token"), "rt-SECRET");
  assert.equal(await G.connection(), null);
  await assert.rejects(G.upcomingMeetings(), (e) => e.kind === "disconnected");
  route = () => json({ access_token: "at-2", expires_in: 1, refresh_token: "rt-2", scope: G.GOOGLE_SCOPE });
  await G.completeConnect("code-2", verifier, "f1");
  route = (c) => c.url.includes("/token") ? json({ error: "invalid_grant" }, 400) : json({ items: [] });
  await assert.rejects(G.upcomingMeetings(), (e) => e instanceof G.GoogleError && e.kind === "disconnected");
  assert.equal(await G.connection(), null, "dead grant forgotten");
  console.log("ok disconnect + invalid_grant");

  assert.deepEqual(G.parseEmails("A@x.it, b@y.com;bad  a@x.it\nno@"), { ok: ["a@x.it", "b@y.com"], bad: ["bad", "no@"] });
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  assert.equal(G.googleConfigured(), false);
  console.log("ok parse + config");
  console.log("meet tests passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
