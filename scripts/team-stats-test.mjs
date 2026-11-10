/*
 * Team workload stats: grouped reads, sender vs owner, and won value kept apart from registered income.
 *   node scripts/team-stats-test.mjs
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-team-stats-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
const root = pathToFileURL(process.cwd() + "/").href;
const stub = (code) => ({ url: "data:text/javascript," + encodeURIComponent(code), shortCircuit: true });
registerHooks({
  resolve(spec, ctx, next) {
    const name = String(spec);
    if (name === "server-only" || name.endsWith("/server-only")) return stub("");
    if (name === "next/headers" || name.endsWith("/next/headers")) return stub("export async function headers(){return new Headers()}export async function cookies(){return{get:()=>undefined,set(){},delete(){}}}");
    if (name === "next/server" || name.endsWith("/next/server") || name.endsWith("/next/server.js")) return stub("export function after(f){return typeof f==='function'?f():f}");
    if (name === "next/cache" || name.endsWith("/next/cache")) return stub("export const revalidatePath=()=>{};export const cacheLife=()=>{};export const cacheTag=()=>{};export const unstable_cache=(fn)=>fn");
    if (name === "next/navigation" || name.endsWith("/next/navigation")) return stub("export function redirect(u){throw new Error('redirect '+u)}");
    if (name.startsWith("@/")) return next(new URL(name.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const statsSrc = readFileSync("lib/team-stats.ts", "utf8");
assert.equal(statsSrc.includes("crm_kpi_daily"), false, "the daily series is computed from the source rows");
assert.match(readFileSync("lib/team-types.ts", "utf8"), /const FOUNDER_ONLY[^\n]*\["team", "audit"\]/);
assert.match(readFileSync("app/(admin)/admin/(shell)/team/page.tsx", "utf8"), /requireSection\("team"\)/);
assert.match(readFileSync("app/(admin)/admin/(shell)/team/[id]/page.tsx", "utf8"), /requireSection\("team"\)/);
assert.match(readFileSync("app/(admin)/admin/team-actions.ts", "utf8"), /guardSection\("team"\)/);

const NOW = new Date("2026-11-10T15:00:00.000Z");

try {
  const S = await import("../lib/team-stats.ts");
  assert.equal(S.parseTeamPeriod(undefined), 30);
  assert.equal(S.parseTeamPeriod("7"), 7);
  assert.equal(S.parseTeamPeriod("90"), 90);
  assert.equal(S.parseTeamPeriod("14"), 30);
  assert.equal(S.parseTeamPeriod(["7"]), 7);
  assert.equal(S.parseEmailLimit(undefined), 20);
  assert.equal(S.parseEmailLimit("40"), 40);
  assert.equal(S.parseEmailLimit("999"), 200);
  assert.equal(S.teamQuery(30), "");
  assert.equal(S.teamQuery(7), "?giorni=7");
  assert.equal(S.teamQuery(7, { altre: 40 }), "?giorni=7&altre=40");
  assert.equal(S.romeToday(new Date("2026-11-10T23:30:00.000Z")), "2026-11-11");
  const window = S.periodWindow(7, NOW);
  assert.equal(window.fromDay, "2026-11-04");
  assert.equal(window.toDay, "2026-11-10");
  assert.equal(window.fromIso, "2026-11-04T00:00:00.000Z");
  assert.equal(window.toIso, "2026-11-11T00:00:00.000Z");
  assert.equal(window.dayList.length, 7);
  assert.deepEqual([window.dayList[0], window.dayList.at(-1)], ["2026-11-04", "2026-11-10"]);
  console.log("ok period");

  const M = await import("../lib/migrate.ts");
  await M.ensureCrmSchema();
  await M.ensureEmailSchema();
  const { db } = await import("../lib/db.ts");
  const addUser = async (id, name) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active) VALUES (?, ?, ?, '!', 'member', 1)", args: [id, `${id}@team.test`, name] });
  };
  await addUser("alice", "Alice");
  await addUser("bob", "Bob");
  await addUser("cara", "Cara");
  await addUser("zero", "Zero");
  const contact = async (id, name, email, norm, owner, archived) => {
    await db().execute({
      sql: `INSERT INTO crm_contacts (id, business_name, email, email_norm, owner_user_id, archived, city, stage, source, next_action_at)
            VALUES (?, ?, ?, ?, ?, ?, 'Aosta', 'call', 'manuale', '2026-11-20')`,
      args: [id, name, email, norm, owner, archived],
    });
  };
  await contact("c-alfa", "Alfa", "giulia@alfa.test", "giulia@alfa.test", "bob", 0);
  await contact("c-zz", "Alfa due", "giulia@alfa.test", "giulia@alfa.test", "cara", 0);
  await contact("c-beta", "Beta", " Bob@beta.test ", "", "alice", 0);
  await contact("c-live", "Viva", "viva@alfa.test", "viva@alfa.test", "alice", 0);
  await contact("c-old", "Vecchia", "vecchia@alfa.test", "vecchia@alfa.test", "alice", 1);
  const mail = async (id, user, recipients, subject, ok, at) => {
    await db().execute({
      sql: "INSERT INTO email_send_log (id, user_id, recipients, subject, ok, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, user, recipients, subject, ok, at],
    });
  };
  await mail("e1", "alice", "Giulia <giulia@alfa.test>, bob@beta.test", "Proposta", 1, "2026-11-05T10:00:00.000Z");
  await mail("e2", "alice", "nessuno@alfa.test", "Bozza", 0, "2026-11-06T10:00:00.000Z");
  await mail("e3", "alice", "fuori@alfa.test", "Vecchia", 1, "2026-11-03T23:59:59.000Z");
  await mail("e4", "alice", "bordo@alfa.test", "Bordo", 1, "2026-11-04T00:00:00.000Z");
  await mail("e5", "bob", "giulia@alfa.test", "Dal owner", 1, "2026-11-07T10:00:00.000Z");
  await mail("e6", "alice", "tardi@alfa.test", "Dopo", 1, "2026-11-11T00:00:00.000Z");
  const activity = async (id, title, assignee, due, done) => {
    await db().execute({
      sql: "INSERT INTO crm_activities (id, title, kind, due_date, assignee_user_id, done_at) VALUES (?, ?, 'call', ?, ?, ?)",
      args: [id, title, due, assignee, done],
    });
  };
  await activity("a1", "Fatto", "alice", "2026-11-05", "2026-11-05T10:00:00.000Z");
  await activity("a2", "Vecchio", "alice", "2026-10-01", "2026-10-01T10:00:00.000Z");
  await activity("a3", "Ritardo", "alice", "2026-11-09", null);
  await activity("a4", "Oggi", "alice", "2026-11-10", null);
  await activity("a5", "Bob fatto", "bob", "2026-11-06", "2026-11-06T08:00:00.000Z");
  const deal = async (id, contactId, title, stage, value, owner, closed) => {
    await db().execute({
      sql: `INSERT INTO crm_opportunities (id, contact_id, title, stage, value_eur, owner_user_id, source, opened_at, closed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'manuale', '2026-11-01T00:00:00.000Z', ?)`,
      args: [id, contactId, title, stage, value, owner, closed],
    });
  };
  await deal("d1", "c-alfa", "Sito", "vinto", 1500.5, "alice", "2026-11-05T12:00:00.000Z");
  await deal("d2", "c-alfa", "Extra", "vinto", 200, "alice", "2026-11-08T12:00:00.000Z");
  await deal("d3", "c-alfa", "Fuori", "vinto", 9999, "alice", "2026-10-02T12:00:00.000Z");
  await deal("d4", "c-alfa", "Perso", "perso", 8000, "alice", "2026-11-06T12:00:00.000Z");
  await deal("d5", "c-alfa", "Aperto", "call", 4000, "alice", null);
  await deal("d6", "c-old", "Archivio", "vinto", 50, "alice", "2026-11-07T12:00:00.000Z");
  await deal("d7", "c-alfa", "Bob vinto", "vinto", 80, "bob", "2026-11-09T12:00:00.000Z");
  const job = async (id, user, cents, date) => {
    await db().execute({
      sql: "INSERT INTO team_jobs (id, user_id, client, description, amount_cents, date, area) VALUES (?, ?, 'Cliente', 'Lavoro', ?, ?, 'sviluppo')",
      args: [id, user, cents, date],
    });
  };
  await job("j1", "alice", 25000, "2026-11-05");
  await job("j2", "alice", 9000, "2026-11-03");
  await job("j3", "bob", 10000, "2026-11-10");
  await job("j4", "alice", 500, "2026-11-04");

  const kpis = await S.teamMemberKpisFor(7, NOW);
  const alice = kpis.get("alice");
  const bob = kpis.get("bob");
  assert.ok(alice && bob);
  assert.equal(kpis.has("zero"), false);
  assert.deepEqual(S.ZERO_KPI, { emailsSent: 0, emailsUnconfirmed: 0, contacts: 0, activitiesDone: 0, activitiesOverdue: 0, wonEur: 0, incomeCents: 0 });
  assert.equal(alice.emailsSent, 2, "sent mail in the window, including the boundary instant");
  assert.equal(alice.emailsUnconfirmed, 1);
  assert.equal(bob.emailsSent, 1, "the sender is counted, not the contact owner");
  assert.equal(alice.contacts, 2, "archived contacts stay out of the stock");
  assert.equal(bob.contacts, 1);
  assert.equal(kpis.get("cara")?.contacts, 1);
  assert.equal(alice.activitiesDone, 1);
  assert.equal(alice.activitiesOverdue, 1, "due today in Rome is not overdue");
  assert.equal(bob.activitiesDone, 1);
  assert.equal(alice.wonEur, 1750.5, "won value includes a deal on an archived contact and ignores lost, open and older wins");
  assert.equal(bob.wonEur, 80);
  assert.equal(alice.incomeCents, 25500);
  assert.equal(bob.incomeCents, 10000);
  assert.notEqual(alice.wonEur, alice.incomeCents / 100);
  console.log("ok kpis");

  const page = await S.listMemberEmails("alice", window, 2);
  assert.equal(page.more, true);
  assert.deepEqual(page.rows.map((row) => row.id), ["e2", "e1"]);
  assert.equal(page.rows[1].ok, true);
  assert.equal(page.rows[0].ok, false);
  assert.equal(page.contacts.get("giulia@alfa.test")?.id, "c-alfa");
  assert.equal(page.contacts.get("giulia@alfa.test")?.name, "Alfa");
  assert.equal(page.contacts.get("bob@beta.test")?.name, "Beta");
  assert.equal(page.contacts.has("vecchia@alfa.test"), false);
  console.log("ok emails");

  const trend = await S.memberTrend("alice", window);
  assert.equal(trend.length, 7);
  const byDay = Object.fromEntries(trend.map((point) => [point.day, point]));
  assert.deepEqual(byDay["2026-11-04"], { day: "2026-11-04", emails: 1, activities: 0, won: 0, incomeCents: 500 });
  assert.deepEqual(byDay["2026-11-05"], { day: "2026-11-05", emails: 1, activities: 1, won: 1, incomeCents: 25000 });
  assert.equal(byDay["2026-11-07"].won, 1);
  assert.equal(byDay["2026-11-08"].won, 1);
  assert.equal(byDay["2026-11-03"], undefined);
  assert.equal(trend.reduce((sum, point) => sum + point.incomeCents, 0), alice.incomeCents);
  assert.equal(trend.reduce((sum, point) => sum + point.won, 0), 3);
  console.log("ok trend");

  const { getEarnings, getUser, listUsers } = await import("../lib/team.ts");
  assert.equal((await getUser("alice"))?.name, "Alice");
  assert.equal(await getUser("missing"), null);
  assert.equal(await getUser("../alice"), null);
  assert.equal((await listUsers()).length, 4);
  const earn = await getEarnings({
    id: "alice", email: "alice@team.test", name: "Alice", roles: ["founder"], area: null, avatarUrl: null, emailAccess: true, issuedAt: 0, expiresAt: 0,
  }, "7", "alice", NOW);
  assert.equal(earn.totalCents, alice.incomeCents);
  assert.equal(earn.jobs, 2);
  console.log("ok earnings window");
  console.log("team stats ok");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
