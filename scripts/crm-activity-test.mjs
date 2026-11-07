/*
 * Activities are explicit rows. Follow-ups, ingest, CSV, Meet and contact stage do not create them.
 * Team scope is founder-only. A desk note never appears in a list, a search or a count.
 *   node scripts/crm-activity-test.mjs
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-act-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.CRM_INGEST_SECRET;
globalThis.__jar = new Map();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.9","user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript," + encodeURIComponent("export async function after(f){if(typeof f==='function') await f()}"), shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const revalidatePath=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const untouched = ["app/admin/meet-actions.ts", "app/admin/crm-actions.ts", "app/api/crm/ingest/route.ts", "lib/crm-import.ts", "lib/crm.ts", "lib/client-meet.ts", "lib/crm-opportunity.ts"];
for (const file of untouched) {
  const src = readFileSync(file, "utf8");
  assert.equal(src.includes("createActivity"), false, file);
  assert.equal(src.includes("crm_activities"), false, file);
}

const Nav = await import("../lib/crm-nav.ts");
const fall = Nav.romeWall("2026-10-25", "02:30");
assert.ok(fall);
assert.equal(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(fall)), "2026-10-25, 02:30");
assert.equal(Nav.romeWall("2026-03-29", "02:30"), null, "spring gap is not moved to the next day");
assert.ok(Nav.romeWall("2026-03-29", "03:30"));
assert.deepEqual(Nav.romeWeek("2026-10-25"), { start: "2026-10-19", end: "2026-10-25" });
assert.deepEqual(Nav.romeWeek("2026-03-29"), { start: "2026-03-23", end: "2026-03-29" });
const pipeBack = Nav.mailReturn("123e4567-e89b-42d3-a456-426614174000", Nav.parseContactMailQuery(new URLSearchParams("orig=pipeline&da=q%3DAlba%26periodo%3Dtrimestre")));
assert.equal(pipeBack, "/admin/crm/pipeline?q=Alba&periodo=trimestre&c=123e4567-e89b-42d3-a456-426614174000");
const radarBack = Nav.mailReturn("123e4567-e89b-42d3-a456-426614174000", Nav.parseContactMailQuery(new URLSearchParams("orig=radar&da=q%3DAlba%26prio%3Dalta")));
assert.match(radarBack, /^\/admin\/crm\/radar\?/);
assert.match(radarBack, /prio=alta/);
assert.equal(Nav.mailReturn("123e4567-e89b-42d3-a456-426614174000", Nav.parseContactMailQuery(new URLSearchParams("da=%2F%2Fevil.example"))).includes("evil"), false);
assert.equal(Nav.followUpScope("team", false), "mine");
assert.equal(Nav.followUpScope("team", true), "team");
console.log("ok dates and return");

const TODAY = "2026-11-07";
try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((name) => name.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const M = await import("../lib/migrate.ts");
  await M.ensureCrmSchema();
  await M.ensureDeskSchema();
  await M.ensureCrmSchema();
  const K = await import("../lib/crm.ts");
  const A = await import("../lib/crm-activity.ts");
  const Act = await import("../app/admin/crm-activity-actions.ts");
  const I = await import("../lib/crm-import.ts");
  const Meet = await import("../lib/client-meet.ts");
  const { SignJWT } = await import("jose");
  const { dumpDatabase } = await import("../lib/backup-core.ts");

  const count = async () => Number((await db().execute("SELECT COUNT(*) AS n FROM crm_activities")).rows[0].n);
  const deals = async () => Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n);
  const addUser = async (id, roles) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, 0)", args: [id, `${id}@t.test`, id] });
    for (const role of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, role] });
  };
  const signIn = async (id) => globalThis.__jar.set("ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET)));
  const founder = { id: "u-founder", founder: true };
  const sales = { id: "u-sales", founder: false };
  const other = { id: "u-other", founder: false };

  await addUser("u-founder", ["founder"]);
  await addUser("u-sales", ["commerciale"]);
  await addUser("u-other", ["commerciale"]);
  await addUser("u-pm", ["project_manager"]);

  const before = await count();
  const lead = await K.ingestContact({ business_name: "Iris Act", email: "iris.act@iris-act.test", score: 80, score_reasons: ["Lento"], city: "Torino" });
  await K.setStage(lead.id, "contattato");
  const imported = await I.confirmImport([{ businessName: "Csv Act", email: "csv.act@csv-act.test", score: 99, stage: "vinto" }], "u-sales");
  assert.equal(imported.inserted, 1);
  const csv = (await K.listContacts({ q: "Csv Act" }))[0];
  await K.setStage(csv.id, "call");
  const fresh = await K.getContact(csv.id);
  assert.equal(await K.setFollowUp(csv.id, "Richiamare il csv", "2026-11-08T09:00:00.000Z", fresh.version), "ok");
  await Meet.saveClientMeeting({
    id: "00000000-0000-4000-8000-00000000a0e1", contactId: csv.id, clientName: "NomeSegretoRiunione", clientEmail: "csv.act@csv-act.test",
    title: "Call", agenda: null, start: "2026-11-20T10:00", minutes: 30, meetUrl: "https://meet.google.com/abc-defg-hij", eventId: null, createdBy: "u-founder",
  });
  assert.equal(await count(), before, "ingest, import, stage, follow-up and a Meet row create no activity");
  assert.equal(await deals(), 0, "an activity setup opens no deal");
  assert.equal((await K.getContact(csv.id)).stage, "call");
  assert.equal((await K.getContact(csv.id)).nextAction, "Richiamare il csv", "the follow-up stays the follow-up");
  console.log("ok no implicit activity");

  await db().execute({ sql: "INSERT INTO desk_items (id, user_id, kind, title, body) VALUES ('desk-1', 'u-founder', 'note', 'NotaPrivataScrivaniaXYZ', 'non deve uscire')", args: [] });
  const secret = await A.createActivity({
    title: "SegretoFounderXYZ", kind: "call", dueDate: TODAY, dueTime: "10:30", priority: "alta",
    assigneeUserId: "u-founder", contactId: csv.id, opportunityId: null, idempotencyKey: "secret-key",
  }, founder);
  assert.equal(secret.created, true);
  const again = await A.createActivity({
    title: "SegretoFounderXYZ", kind: "call", dueDate: TODAY, dueTime: "10:30", priority: "alta",
    assigneeUserId: "u-founder", contactId: csv.id, opportunityId: null, idempotencyKey: "secret-key",
  }, founder);
  assert.equal(again.created, false);
  assert.equal(again.id, secret.id);
  assert.equal(await count(), 1, "the same key does not insert a second row");

  const mine = await A.createActivity({
    title: "ChiamataGiuliaXYZ", kind: "email", dueDate: "2026-11-08", dueTime: null, priority: null,
    assigneeUserId: "u-sales", contactId: csv.id, opportunityId: null, idempotencyKey: "giulia-key",
  }, sales);
  assert.equal(mine.created, true);
  assert.equal((await K.getContact(csv.id)).stage, "call", "creating an activity does not move the contact");
  assert.equal(await deals(), 0, "creating an activity does not open a deal");

  const stolen = await A.createActivity({
    title: "Non mia", kind: "altro", dueDate: TODAY, dueTime: null, priority: null,
    assigneeUserId: "u-founder", contactId: null, opportunityId: null, idempotencyKey: "stolen",
  }, sales);
  assert.equal(stolen.error, "forbidden");
  const gap = await A.createActivity({
    title: "Ora inesistente", kind: "call", dueDate: "2026-03-29", dueTime: "02:30", priority: null,
    assigneeUserId: "u-sales", contactId: null, opportunityId: null, idempotencyKey: "gap",
  }, sales);
  assert.equal(gap.error, "invalid");
  console.log("ok create");

  const salesList = await A.listActivities({ scope: "team", stato: "tutte" }, sales);
  assert.deepEqual(salesList.map((a) => a.title), ["ChiamataGiuliaXYZ"], "team requested by a commerciale is still only theirs");
  const salesSearch = await A.listActivities({ q: "SegretoFounderXYZ", scope: "team", stato: "tutte" }, sales);
  assert.equal(salesSearch.length, 0);
  const salesDesk = await A.listActivities({ q: "NotaPrivataScrivaniaXYZ", stato: "tutte" }, sales);
  assert.equal(salesDesk.length, 0);
  assert.equal(await A.getActivity(secret.id, sales), null);
  assert.equal(JSON.stringify(salesList).includes("SegretoFounderXYZ"), false);
  assert.equal(JSON.stringify(salesList).includes("NotaPrivataScrivaniaXYZ"), false);
  const salesTotals = await A.activityTotals(sales, "team", TODAY, "2026-11");
  assert.equal(salesTotals.today, 0, "a commerciale count does not include the founder's row");
  const founderTeam = await A.listActivities({ scope: "team", stato: "tutte" }, founder);
  assert.ok(founderTeam.some((a) => a.title === "SegretoFounderXYZ") && founderTeam.some((a) => a.title === "ChiamataGiuliaXYZ"));
  assert.equal(JSON.stringify(founderTeam).includes("NotaPrivataScrivaniaXYZ"), false, "the desk stays out of the team list");
  const founderMine = await A.listActivities({ scope: "mine", stato: "tutte" }, founder);
  assert.deepEqual(founderMine.map((a) => a.title), ["SegretoFounderXYZ"]);
  const marks = await A.monthMarks(other, "team", "2026-11");
  assert.equal(JSON.stringify(marks).includes("NomeSegretoRiunione"), false);
  assert.equal(marks["2026-11-20"], undefined, "someone else's meeting is not a dot");
  const founderMarks = await A.monthMarks(founder, "team", "2026-11");
  assert.equal(founderMarks["2026-11-20"].meetings, 1);
  assert.equal(JSON.stringify(founderMarks).includes("NomeSegretoRiunione"), false, "dots have no client name");
  console.log("ok privacy");

  assert.equal(await A.updateActivity(mine.id, { title: "Stale" }, 2, sales), "conflict");
  assert.equal((await A.getActivity(mine.id, sales)).title, "ChiamataGiuliaXYZ");
  assert.equal(await A.updateActivity(mine.id, { title: "Chiamata aggiornata", priority: "bassa", dueDate: "2026-11-09" }, 1, sales), "ok");
  const edited = await A.getActivity(mine.id, sales);
  assert.equal(edited.title, "Chiamata aggiornata");
  assert.equal(edited.priority, "bassa");
  assert.equal(edited.version, 2);
  assert.equal(await A.updateActivity(secret.id, { title: "Rubata" }, 1, sales), "forbidden");
  assert.equal((await A.getActivity(secret.id, founder)).title, "SegretoFounderXYZ");
  assert.equal(await A.setActivityDone(mine.id, true, 1, sales), "conflict");
  assert.equal(await A.setActivityDone(mine.id, true, 2, sales), "ok");
  assert.ok((await A.getActivity(mine.id, sales)).doneAt);
  assert.equal(await A.setActivityDone(mine.id, false, 3, sales), "ok");
  assert.equal((await A.getActivity(mine.id, sales)).doneAt, null);
  assert.equal(await A.setActivityDone(secret.id, true, 1, other), "forbidden");
  console.log("ok version");

  await signIn("u-pm");
  await assert.rejects(() => Act.createActivityAction({ title: "No", kind: "call", dueDate: TODAY, assigneeUserId: "u-pm", idempotencyKey: "pm-key" }), /unauthorized/);
  await signIn("u-sales");
  const denied = await Act.createActivityAction({ title: "Altri", kind: "call", dueDate: TODAY, assigneeUserId: "u-founder", idempotencyKey: "deny-key" });
  assert.match(denied.error, /assegnate a te/);
  const formula = await Act.createActivityAction({ title: "=cmd|' /C calc'!A0", kind: "altro", dueDate: TODAY, dueTime: "15:00", assigneeUserId: "u-sales", idempotencyKey: "formula-act" });
  assert.equal(formula.ok, "Attività creata.");
  const stored = await A.getActivity(formula.id, sales);
  assert.equal(stored.title, "'=cmd|' /C calc'!A0");
  const audit = (await db().execute("SELECT action, details FROM audit_log WHERE action = 'crm.activity_create'")).rows.map((r) => String(r.details));
  assert.ok(audit.length >= 1);
  assert.equal(audit.some((d) => d.includes("=cmd") || d.includes("Segreto") || d.includes("csv.act")), false, "audit keeps kind, not the title or the email");
  console.log("ok action");

  const dump = await dumpDatabase(db());
  assert.ok(dump.schema.some((s) => s.name === "crm_activities"));
  assert.ok(dump.tables.crm_activities.rows.length >= 2);
  console.log("ok backup dump");
  console.log("crm activities: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
