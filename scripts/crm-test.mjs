/*
 * CRM self-test, no network and no real secrets (temp SQLite, fake ingest secret generated here):
 *   node scripts/crm-test.mjs
 * Checks the crm permission, dedupe normalizers and DB dedupe, site lead idempotency, server-side refusal of actions,
 * and /api/crm/ingest auth (503 unconfigured, 401 wrong bearer, 400 bad payload, 200 + dedupe).
 * Phase 1: Radar sends need the Email permission and the send limits, Meet never touches CRM data without crm,
 * follow-up scope and "done", Oggi counts, palette search, CRM sections, old rubrica links through the proxy.
 * Phase 2: optimistic version on every contact writer, former members kept as owners, rubrica URL state and saved
 * views, panel quick actions and bulk changes (partial results, permissions, never email).
 * Mail goes to an in-memory fake provider: nothing leaves the machine.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-crm-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD_HASH; delete process.env.CRM_INGEST_SECRET;
for (const k of ["RESEND_API_KEY", "MAIL_FROM", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "AGENCY_IMAP_USER", "AGENCY_IMAP_PASSWORD", "DISCORD_WEBHOOK_URL"]) delete process.env[k];
globalThis.__jar = new Map();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.9","user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "@/lib/mail") return { url: "data:text/javascript," + encodeURIComponent("export function mailProvider(){return globalThis.__mail ?? null}"), shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    // proxy.ts gets the real next/server (NextRequest/NextResponse); everything else the stub.
    if (spec === "next/server" && ctx.parentURL?.endsWith("/proxy.ts")) return next("next/server.js", ctx);
    if (spec === "next/server") return { url: "data:text/javascript," + encodeURIComponent("export function after(f){return typeof f==='function'?f():f};export const NextResponse={json:(b,i={})=>new Response(JSON.stringify(b),{status:i.status??200,headers:{'content-type':'application/json',...(i.headers??{})}})}"), shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

try {
  // 1. Permissions: crm for founder, commerciale, marketing, assistenza; nobody else.
  const T = await import("../lib/team-types.ts");
  const allowed = ["founder", "commerciale", "marketing", "assistenza"];
  for (const r of T.TEAM_ROLES) assert.equal(T.canAccess({ roles: [r], emailAccess: true }, "crm"), allowed.includes(r), `crm for ${r}`);
  assert.ok(T.canAccess({ roles: ["designer", "commerciale"], emailAccess: false }, "crm"), "union of roles");
  assert.equal(T.SECTION_HREF.crm, "/admin/crm");
  console.log("ok permissions");

  // 2. Pure dedupe keys.
  const C = await import("../lib/crm-core.ts");
  assert.equal(C.normPhone("+39 333 123 4567"), "3331234567");
  assert.equal(C.normPhone("0039 333-1234567"), "3331234567");
  assert.equal(C.normPhone("12"), "");
  assert.equal(C.websiteDomain("https://www.Pizzeria-Da-Mario.it/menu"), "pizzeria-da-mario.it");
  assert.equal(C.websiteDomain("pizzeria-da-mario.it"), "pizzeria-da-mario.it");
  assert.deepEqual(C.dedupeKeys({ email: " Info@Mario.IT ", website: null }).email, "info@mario.it");
  assert.equal(C.dedupeKeys({ email: "mario@gmail.com" }).domain, "", "webmail never a company domain");
  assert.equal(C.dedupeKeys({ email: "info@mario.it" }).domain, "mario.it", "company email gives the domain");
  assert.ok(C.sameContact(C.dedupeKeys({ phone: "333 1234567" }), C.dedupeKeys({ phone: "+393331234567" })));
  assert.ok(!C.sameContact(C.dedupeKeys({ email: "a@gmail.com" }), C.dedupeKeys({ email: "b@gmail.com" })));
  assert.equal(C.conversionRate(0, 0), null);
  assert.equal(C.conversionRate(1, 3), 0.25);
  console.log("ok dedupe keys");

  // 3. DB dedupe + site leads.
  const { db } = await import("../lib/db.ts");
  // crm_contacts as production has it today (no version column): the runtime ensure must add it.
  const legacy = (f, sql) => (f === "012_crm.sql" ? sql.replace(/,\s*\n\s*version INTEGER[^\n]*/, "") : sql);
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(legacy(f, readFileSync(join("db", f), "utf8")));
  assert.ok(!(await db().execute("PRAGMA table_info(crm_contacts)")).rows.some((r) => r.name === "version"), "test starts from a pre-phase-2 table");
  const M = await import("../lib/migrate.ts");
  await M.ensureCrmSchema();
  await M.ensureCrmSchema();
  assert.ok((await db().execute("PRAGMA table_info(crm_contacts)")).rows.some((r) => r.name === "version" && Number(r.notnull) === 1 && String(r.dflt_value) === "1"), "version added by ensureCrmSchema");
  assert.ok((await db().execute("PRAGMA table_info(crm_contacts)")).rows.some((r) => r.name === "kind" && Number(r.notnull) === 0), "kind column is nullable");
  assert.ok((await db().execute("PRAGMA table_info(crm_contacts)")).rows.some((r) => r.name === "estimated_value_cents"), "estimate column");
  assert.ok((await db().execute("PRAGMA table_info(crm_contacts)")).rows.some((r) => r.name === "estimated_value_note"), "estimate note");
  assert.ok((await db().execute("PRAGMA table_info(crm_kpi_daily)")).rows.some((r) => r.name === "contacts_contacted"), "contacted kpi column");
  assert.ok((await db().execute("PRAGMA table_info(crm_kpi_daily)")).rows.some((r) => r.name === "potential_value_cents"), "potential kpi column");
  const pipeSql = readFileSync(join("db", "019_crm_pipeline.sql"), "utf8");
  assert.ok(!/\bALTER\b/i.test(pipeSql), "pipeline sql stays re-runnable");
  await db().executeMultiple(pipeSql);
  await db().executeMultiple(pipeSql);
  assert.ok((await db().execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'crm_saved_views'")).rows.length, "saved views table");
  const rubricaSql = readFileSync(join("db", "018_crm_rubrica.sql"), "utf8");
  assert.ok(!/\bALTER\b/i.test(rubricaSql), "the sql file stays re-runnable");
  await db().executeMultiple(rubricaSql);
  await db().executeMultiple(rubricaSql);
  assert.ok((await db().execute("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'crm_contacts_owner'")).rows.length, "owner index");
  const K = await import("../lib/crm.ts");
  const a = await K.createContact({ businessName: "Pizzeria Mario", email: "info@mario.it", phone: "333 1234567", source: "manuale" }, null);
  assert.equal(a.duplicate, false);
  for (const dup of [{ email: "INFO@mario.it" }, { phone: "+39 3331234567" }, { website: "https://www.mario.it" }, { email: "altro@mario.it" }]) {
    const r = await K.createContact({ businessName: "Copia", source: "manuale", ...dup }, null);
    assert.deepEqual(r, { id: a.id, duplicate: true }, `duplicate by ${JSON.stringify(dup)}`);
  }
  const b = await K.createContact({ businessName: "Bar Luigi", email: "luigi@gmail.com", source: "manuale" }, null);
  assert.equal(b.duplicate, false, "same webmail domain is not a duplicate");
  assert.deepEqual(await K.updateContact(b.id, { businessName: "Bar Luigi", email: "info@mario.it", source: "manuale" }), { duplicate: a.id });
  assert.equal(await K.updateContact(b.id, { businessName: "Bar Luigi 2", email: "luigi@gmail.com", source: "manuale" }), "ok");
  assert.deepEqual(await K.setStage(b.id, "vinto"), { from: "nuovo" });

  await db().execute({ sql: "INSERT INTO contact_requests (id, name, email, subject, message, lang) VALUES ('r1','Anna Neri','anna@studio.it','Sito','Vorrei un preventivo','it')" });
  await db().execute({ sql: "INSERT INTO contact_requests (id, name, email, subject, message, lang) VALUES ('r2','Mario','info@mario.it','Ancora','Seconda richiesta','it')" });
  await K.backfillRequests();
  await K.leadFromRequest({ id: "r1", name: "Anna Neri", email: "anna@studio.it" });
  const leads = await K.listContacts({ source: "sito" });
  assert.equal(leads.length, 1, "one lead per request, idempotent");
  assert.equal(leads[0].email, "anna@studio.it");
  assert.equal((await K.listNotes(a.id)).length, 1, "request from a known contact becomes a note");
  await K.leadFromRequest({ id: "r3", name: "x", email: "y" }).catch(() => assert.fail("leadFromRequest must never throw"));
  const stats = await K.crmStats();
  assert.equal(stats.won, 1);
  assert.ok(stats.leadsMonth >= 3);
  console.log("ok db dedupe + site leads");

  // 4. Server actions refuse without a crm session.
  const A = await import("../app/admin/crm-actions.ts");
  await assert.rejects(() => A.moveStageAction(a.id, "vinto"), /unauthorized/);
  await assert.rejects(() => A.sendDraftAction(a.id), /unauthorized/);
  console.log("ok actions guarded");

  // 5. Ingest auth.
  assert.equal(C.ingestAuth("Bearer x", undefined), "unconfigured");
  assert.equal(C.ingestAuth("Bearer short", "short"), "unconfigured");
  const secret = randomBytes(24).toString("hex");
  assert.equal(C.ingestAuth(`Bearer ${secret}`, secret), "ok");
  assert.equal(C.ingestAuth(`bearer  ${secret} `, secret), "ok");
  assert.equal(C.ingestAuth(`Bearer ${secret}x`, secret), "unauthorized");
  assert.equal(C.ingestAuth(secret, secret), "unauthorized", "scheme required");
  assert.equal(C.ingestAuth(null, secret), "unauthorized");
  const { POST } = await import("../app/api/crm/ingest/route.ts");
  const call = (auth, body) => POST(new Request("http://t/api/crm/ingest", { method: "POST", headers: auth ? { authorization: auth } : {}, body: typeof body === "string" ? body : JSON.stringify(body) }));
  const payload = { contacts: [
    { business_name: "Ottica Bianchi", email: "info@otticabianchi.it", city: "Torino", score: 82, score_reasons: ["Sito lento"], draft: { subject: "Il vostro sito", body_text: "Buongiorno, ..." } },
    { business_name: "Pizzeria doppione", website: "mario.it" },
  ] };
  assert.equal((await call(`Bearer ${secret}`, payload)).status, 503, "secret missing");
  process.env.CRM_INGEST_SECRET = secret;
  assert.equal((await call(null, payload)).status, 401);
  assert.equal((await call("Bearer wrong-wrong-wrong-wrong", payload)).status, 401);
  assert.equal((await call(`Bearer ${secret}`, "{nope")).status, 400);
  assert.equal((await call(`Bearer ${secret}`, { contacts: [{ email: "x" }] })).status, 400);
  const ok = await call(`Bearer ${secret}`, payload);
  assert.equal(ok.status, 200);
  const res = await ok.json();
  assert.equal(res.inserted, 1); assert.equal(res.duplicates, 1); assert.equal(res.ids[1], a.id);
  const radar = await K.listContacts({ source: "radar" });
  assert.equal(radar.length, 1); assert.equal(radar[0].score, 82); assert.deepEqual(radar[0].scoreReasons, ["Sito lento"]);
  const drafts = await K.listDrafts([radar[0].id]);
  assert.equal(drafts.length, 1); assert.equal(drafts[0].status, "bozza", "ingest never sends");
  assert.equal((await (await call(`Bearer ${secret}`, payload)).json()).inserted, 0, "re-ingest dedupes");
  assert.deepEqual(Object.keys(res).sort(), ["duplicates", "ids", "inserted"], "ingest response unchanged");
  assert.ok((await K.listContacts({})).some((c) => c.id === radar[0].id), "Iris prospects still land in the rubrica (legacy behaviour kept)");
  console.log("ok ingest");

  // 6. Phase 1: who may send, Meet without crm, follow-ups, Oggi data, search, sections and old links.
  const { SignJWT } = await import("jose");
  await M.ensureTeamSchema();
  // db/006_email.sql only documents email_send_log (no created_at default); production gets ensureEmailSchema's table.
  await db().execute("DROP TABLE email_send_log");
  await M.ensureEmailSchema();
  const addUser = async (id, roles, emailAccess) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, ?)", args: [id, `${id}@t.test`, `Utente ${id}`, emailAccess ? 1 : 0] });
    for (const r of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, r] });
  };
  const signIn = async (id) => globalThis.__jar.set("ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET)));
  await addUser("u-sales", ["commerciale"], false);
  await addUser("u-mail", ["commerciale"], true);
  await addUser("u-pm", ["project_manager"], false);
  const sent = [];
  globalThis.__mail = { send: async (m) => { sent.push(m); return { messageId: `<t${sent.length}@test.invalid>` }; } };

  const draft = drafts[0];
  await signIn("u-sales");
  assert.match((await A.sendDraftAction(draft.id)).error ?? "", /casella Email/, "crm without Email cannot send");
  assert.equal(sent.length, 0);
  assert.equal((await K.getDraft(draft.id)).sentBy, null, "a refused send does not claim the draft");
  await signIn("u-mail");
  const collab = await import("../lib/mail/collab.ts");
  for (let i = 0; i < collab.SEND_LIMITS.perUser10Min; i++) {
    await db().execute({ sql: "INSERT INTO email_send_log (id, user_id, recipients, subject, ok, created_at) VALUES (?, 'u-mail', 'x@t.test', 's', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))", args: [`log-${i}`] });
  }
  assert.match((await A.sendDraftAction(draft.id)).error ?? "", /10 minuti/, "Radar sends count toward the inbox limits");
  assert.equal(sent.length, 0);
  assert.equal((await K.getDraft(draft.id)).status, "bozza");
  await db().execute("DELETE FROM email_send_log WHERE user_id = 'u-mail'");
  const okSend = await A.sendDraftAction(draft.id);
  assert.ok(okSend.ok, `crm + Email under the limit sends: ${JSON.stringify(okSend)}`);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["info@otticabianchi.it"]);
  assert.equal((await K.getDraft(draft.id)).status, "inviata");
  console.log("ok radar send needs Email + send limits");

  assert.deepEqual(await K.inviteContacts({ roles: ["project_manager"] }), [], "Riunioni without crm gets no CRM contacts");
  assert.ok((await K.inviteContacts({ roles: ["commerciale"] })).some((c) => c.id === a.id));
  const Meet = await import("../app/admin/meet-actions.ts");
  const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const invite = { client_name: "Mario Rossi", client_email: "info@mario.it", title: "Call conoscitiva", date: future, time: "10:00", minutes: "30", contact_id: a.id, meet_url: "https://meet.google.com/abc-defg-hij" };
  const before = await K.getContact(a.id);
  const notesBefore = (await K.listNotes(a.id)).length;
  await signIn("u-pm");
  const pm = await Meet.inviteClientAction({}, form(invite));
  assert.ok(pm.ok, JSON.stringify(pm));
  const untouched = await K.getContact(a.id);
  assert.equal(untouched.stage, before.stage, "Meet without crm does not move the contact");
  assert.equal(untouched.nextAction, before.nextAction);
  assert.equal((await K.listNotes(a.id)).length, notesBefore, "Meet without crm writes no CRM note");
  assert.equal((await db().execute("SELECT contact_id FROM client_meetings ORDER BY created_at DESC LIMIT 1")).rows[0].contact_id, null);
  await signIn("u-mail");
  assert.ok((await Meet.inviteClientAction({}, form(invite))).ok);
  assert.equal((await K.getContact(a.id)).stage, "call", "with crm the invite still updates the contact as before");
  console.log("ok meet keeps CRM behind crm");

  const rome = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = rome(new Date());
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tmw = tomorrow.toISOString().slice(0, 10);
  const f1 = await K.createContact({ businessName: "Follow Uno", email: "uno@follow.it", source: "manuale", nextAction: "Richiamare", nextActionAt: tmw, ownerUserId: "u-sales" }, "u-sales");
  assert.ok(!(await K.dueActions("u-sales", today)).some((x) => x.id === f1.id), "desk default: tomorrow not due yet");
  assert.ok((await K.dueActions("u-sales", today, tmw)).some((x) => x.id === f1.id), "Oggi includes tomorrow");
  assert.ok(!(await K.dueActions("u-mail", today, tmw)).some((x) => x.id === f1.id), "Le mie shows only mine");
  assert.ok((await K.dueActions(null, today, tmw)).some((x) => x.id === f1.id), "team view sees it");
  await signIn("u-sales");
  assert.match((await A.completeFollowUpAction(f1.id, today)).error ?? "", /modificato/, "stale follow-up is not cleared");
  assert.ok((await A.completeFollowUpAction(f1.id, tmw)).ok);
  assert.equal((await K.getContact(f1.id)).nextActionAt, null);
  assert.match((await K.listNotes(f1.id))[0].body, /Follow-up completato: Richiamare/);
  await signIn("u-pm");
  await assert.rejects(() => A.completeFollowUpAction(f1.id, tmw), /unauthorized/);
  globalThis.__jar.clear();
  await assert.rejects(() => A.completeFollowUpAction(f1.id, tmw), /unauthorized/);
  console.log("ok follow-ups");

  const ov = await K.crmOverview();
  const open = Number((await db().execute("SELECT COUNT(*) AS n FROM crm_contacts WHERE archived = 0")).rows[0].n);
  assert.equal(ov.total, open);
  assert.equal(Object.values(ov.byStage).reduce((x, y) => x + y, 0), open, "every contact counted in one stage");
  const free = await K.unassignedContacts(20);
  assert.ok(free.length && free.every((c) => !c.ownerUserId && !["vinto", "perso"].includes(c.stage)));
  assert.ok(free.some((c) => c.source === "sito"), "site leads appear as unassigned");
  const top = await K.priorityContacts(3);
  assert.ok(top.every((c, i) => i === 0 || (top[i - 1].score ?? 0) >= (c.score ?? 0)));
  const events = await K.recentCrmEvents(20);
  assert.ok(events.some((e) => e.action === "crm.followup_done" && e.contactName === "Follow Uno"));
  assert.ok(events.every((e) => !("ip" in e) && !("userAgent" in e)), "feed carries no IP or user agent");
  console.log("ok oggi data");

  const Kpi = await import("../lib/crm-kpi.ts");
  assert.equal(Kpi.romeDay(new Date("2026-11-09T22:30:00Z")), "2026-11-09", "22:30 UTC is still 9 Nov in Rome (CET)");
  assert.equal(Kpi.romeDay(new Date("2026-11-09T23:30:00Z")), "2026-11-10", "23:30 UTC is 10 Nov in Rome");
  assert.equal(Kpi.romeDay(new Date("2026-07-09T21:30:00Z")), "2026-07-09", "21:30 UTC is still 9 Jul in Rome (CEST)");
  assert.equal(Kpi.romeDay(new Date("2026-07-09T22:30:00Z")), "2026-07-10");
  assert.equal(Kpi.romeDay(new Date("2026-10-15T22:30:00Z")), "2026-10-16");
  const stamped = await K.createContact({ businessName: "Storico KPI", email: "storico.kpi@gmail.com", source: "manuale", ownerUserId: "u-sales" }, "u-sales", { createdAt: "2026-10-15T22:30:00.000Z" });
  const gone = await K.createContact({ businessName: "Archiviato KPI", email: "archivio.kpi@gmail.com", source: "manuale" }, "u-sales", { createdAt: "2026-10-01T10:00:00.000Z" });
  assert.equal(gone.duplicate, false);
  await db().execute({ sql: "UPDATE crm_contacts SET archived = 1 WHERE id = ?", args: [gone.id] });
  await db().execute({ sql: `INSERT INTO crm_opportunities (id, contact_id, title, stage, source, opened_at, closed_at, created_by) VALUES (?, ?, 'Deal aperto', 'nuovo', 'manuale', '2026-11-01T10:00:00.000Z', NULL, 'u-sales')`, args: ["00000000-0000-4000-8000-00000000kp01", stamped.id] });
  await db().execute({ sql: `INSERT INTO crm_opportunities (id, contact_id, title, stage, source, opened_at, closed_at, created_by) VALUES (?, ?, 'Deal chiuso', 'vinto', 'manuale', '2026-10-01T10:00:00.000Z', '2026-11-05T10:00:00.000Z', 'u-sales')`, args: ["00000000-0000-4000-8000-00000000kp02", stamped.id] });
  assert.ok(await Kpi.backfillKpiDays("2026-11-09") >= 29);
  const kpiRow = async (day) => (await db().execute({ sql: "SELECT * FROM crm_kpi_daily WHERE day = ?", args: [day] })).rows[0];
  const oct15 = await kpiRow("2026-10-15");
  const oct16 = await kpiRow("2026-10-16");
  assert.equal(Number(oct16.contacts_total), Number(oct15.contacts_total) + 1, "a contact created just after midnight in Rome counts the next day");
  assert.equal(oct16.assigned, null, "assignment is not invented for a past day");
  assert.equal(oct15.todo_due, null);
  assert.equal(oct15.overdue, null);
  assert.equal(Number((await kpiRow("2026-11-01")).opportunities_active), Number((await kpiRow("2026-10-31")).opportunities_active) + 1);
  assert.equal(Number((await kpiRow("2026-11-04")).opportunities_active), Number((await kpiRow("2026-11-05")).opportunities_active) + 1, "a deal closed that day is no longer active");
  assert.equal(await Kpi.backfillKpiDays("2026-11-09"), 0, "backfill does not rewrite rows");
  const live = await Kpi.liveKpiCounts("2026-11-09");
  assert.deepEqual(await Kpi.recordOggiKpis(new Date("2026-11-09T10:00:00Z")), live);
  const firstAt = (await kpiRow("2026-11-09")).created_at;
  await Kpi.recordOggiKpis(new Date("2026-11-09T18:00:00Z"));
  const todayRow = await kpiRow("2026-11-09");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_kpi_daily WHERE day = '2026-11-09'")).rows[0].n), 1);
  assert.equal(todayRow.created_at, firstAt, "the same day is updated, not inserted again");
  assert.equal(Number(todayRow.assigned), live.assigned);
  const totals = await Kpi.kpiSeries("contacts_total", "2026-11-09");
  assert.ok(totals.length >= 2 && totals.every((p, i) => i === 0 || p.v >= totals[i - 1].v));
  assert.equal((await Kpi.kpiSeries("assigned", "2026-11-09")).length, 1);
  await db().execute("DELETE FROM crm_opportunities WHERE id IN ('00000000-0000-4000-8000-00000000kp01', '00000000-0000-4000-8000-00000000kp02')");
  console.log("ok kpi snapshot");

  const D = await import("../app/admin/dashboard-actions.ts");
  await signIn("u-pm");
  assert.ok(!(await D.adminSearch("Pizzeria")).some((h) => h.hint.startsWith("Contatto CRM")), "palette hides CRM without crm");
  await signIn("u-sales");
  assert.ok((await D.adminSearch("Pizzeria")).some((h) => h.href === `/admin/crm/${a.id}`), "palette finds contacts with crm");
  globalThis.__jar.clear();
  console.log("ok search");

  const N = await import("../lib/crm-nav.ts");
  assert.deepEqual(N.CRM_SECTIONS.map((x) => x.label), ["Oggi", "Rubrica", "Pipeline", "Radar", "Attività"]);
  for (const x of N.CRM_SECTIONS) assert.ok(existsSync(join("app/admin/(shell)", x.href.slice("/admin/".length), "page.tsx")), `no dead section: ${x.href}`);
  assert.equal(N.legacyRubricaPath("/admin/crm", new URLSearchParams("fase=call&q=bar")), "/admin/crm/rubrica?fase=call&q=bar");
  assert.equal(N.legacyRubricaPath("/admin/crm", new URLSearchParams("archiviato=1")), "/admin/crm/rubrica?archiviato=1");
  assert.equal(N.legacyRubricaPath("/admin/crm", new URLSearchParams()), null);
  assert.equal(N.legacyRubricaPath("/admin/crm", new URLSearchParams("ambito=team")), null, "Oggi keeps its own params");
  assert.equal(N.legacyRubricaPath("/admin/crm/pipeline", new URLSearchParams("q=x")), null);
  assert.equal(N.crmCrumb("/admin/crm"), null);
  assert.equal(N.crmCrumb("/admin/crm/rubrica"), "Rubrica");
  assert.equal(N.crmCrumb("/admin/crm/attivita"), "Attività");
  assert.equal(N.crmCrumb(`/admin/crm/${a.id}`), "Scheda contatto");
  assert.equal(N.followUpScope("team", false), "mine", "Team only for allowed people");
  assert.equal(N.followUpScope("team", true), "team");
  assert.equal(N.followUpScope(undefined, true), "mine", "default is Le mie");
  const { proxy } = await import("../proxy.ts");
  const { NextRequest } = await import("next/server.js");
  const old = proxy(new NextRequest("https://ctrl.test/admin/crm?fase=call&citta=Alba"));
  assert.equal(old.status, 307);
  assert.equal(old.headers.get("location"), "https://ctrl.test/admin/crm/rubrica?fase=call&citta=Alba");
  assert.equal(old.headers.get("cache-control"), "private, no-store");
  assert.equal(old.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(proxy(new NextRequest("https://ctrl.test/admin/crm")).headers.get("location"), null, "Oggi itself is not redirected");
  console.log("ok sections + old links");

  // 7. Phase 2: optimistic version on every writer.
  const base = { businessName: "Concorrenza", email: "conc@vers.it", source: "manuale" };
  const cc = (await K.createContact(base, "u-sales")).id;
  const v1 = (await K.getContact(cc)).version;
  assert.equal(v1, 1, "new contacts start at version 1");
  assert.equal(await K.updateContact(cc, { ...base, businessName: "Prima" }, v1), "ok");
  assert.equal(await K.updateContact(cc, { ...base, businessName: "Seconda" }, v1), "conflict", "stale editor never overwrites");
  assert.equal((await K.getContact(cc)).businessName, "Prima");
  assert.equal(await K.updateContact("00000000-0000-0000-0000-000000000000", { ...base, email: "nessuno.test@gmail.com" }, 1), "notfound");
  assert.equal(await K.setStage(cc, "call", v1), "conflict", "stale stage form refused");
  assert.equal((await K.getContact(cc)).stage, "nuovo");
  let v = (await K.getContact(cc)).version;
  assert.deepEqual(await K.setStage(cc, "call"), { from: "nuovo" }, "kanban drag (no version) still moves");
  assert.equal((await K.getContact(cc)).version, v + 1, "stage change bumps the version");
  v = (await K.getContact(cc)).version;
  assert.equal(await K.setFollowUp(cc, "Richiamare", tmw, v - 1), "conflict");
  assert.equal(await K.setFollowUp(cc, "Richiamare", tmw, v), "ok");
  assert.equal(await K.setOwner(cc, "u-mail", v), "conflict", "owner write with stale version refused");
  v = (await K.getContact(cc)).version;
  assert.equal(await K.completeFollowUp(cc, tmw, "u-sales"), "ok");
  assert.equal((await K.getContact(cc)).version, v + 1, "follow-up done bumps the version");
  v = (await K.getContact(cc)).version;
  await K.setArchived(cc, true); await K.setArchived(cc, false);
  assert.equal((await K.getContact(cc)).version, v + 2, "archive/restore bump the version");
  v = (await K.getContact(cc)).version;
  await K.addNote(cc, "u-sales", "Nota");
  assert.equal((await K.getContact(cc)).version, v, "a note does not invalidate open forms");
  const va = (await K.getContact(a.id)).version;
  await signIn("u-mail");
  const again = await Meet.inviteClientAction({}, form({ ...invite, time: "11:00" }));
  assert.ok(again.ok, JSON.stringify(again));
  assert.ok((await K.getContact(a.id)).version > va, "Meet invite bumps the version (open forms see the change)");
  await signIn("u-sales");
  v = (await K.getContact(cc)).version;
  const edit = (o) => form({ id: cc, business_name: "Dal form", email: "conc@vers.it", ...o });
  assert.match((await A.saveContactAction({}, edit({}))).error ?? "", /ricarica/, "edit without version refused");
  assert.match((await A.saveContactAction({}, edit({ version: String(v - 1) }))).error ?? "", /modificato/, "stale edit refused with a conflict message");
  assert.equal((await K.getContact(cc)).businessName, "Prima");
  assert.ok((await A.saveContactAction({}, edit({ version: String(v) }))).ok);
  assert.equal((await K.getContact(cc)).businessName, "Dal form");
  console.log("ok optimistic version");

  // 8. Offboarding: a former member stays responsible until someone explicitly reassigns.
  await addUser("u-ex", ["commerciale"], false);
  const ex = (await K.createContact({ businessName: "Cliente di un ex", email: "ex@offb.it", source: "manuale", ownerUserId: "u-ex" }, "u-ex")).id;
  assert.ok((await K.crmOwners()).some((o) => o.id === "u-ex"));
  await db().execute("UPDATE admin_users SET active = 0, removed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 'u-ex'");
  const owners = await K.crmOwners();
  assert.ok(!owners.some((o) => o.id === "u-ex"), "former member not offered as a new owner");
  assert.ok(!owners.some((o) => o.id === "u-pm"), "people without crm are not offered");
  assert.ok(owners.some((o) => o.id === "u-sales"));
  let exc = await K.getContact(ex);
  assert.equal(exc.ownerUserId, "u-ex"); assert.equal(exc.ownerActive, false, "flagged as former member"); assert.equal(exc.ownerName, "Utente u-ex");
  assert.equal((await K.getContact(cc)).ownerActive, null, "no owner, no flag");
  assert.equal((await K.getContact(f1.id)).ownerActive, true, "active owner");
  const exEdit = (o) => form({ id: ex, business_name: "Cliente di un ex (modificato)", email: "ex@offb.it", version: String(exc.version), ...o });
  assert.ok((await A.saveContactAction({}, exEdit({ owner_user_id: "u-ex" }))).ok, "saving with the former owner selected keeps it");
  exc = await K.getContact(ex);
  assert.equal(exc.ownerUserId, "u-ex", "historical owner preserved on save");
  assert.match((await A.saveContactAction({}, exEdit({ version: String(exc.version), owner_user_id: "u-pm" }))).error ?? "", /responsabile/i, "owner without crm refused");
  assert.match((await A.saveContactAction({}, form({ id: cc, business_name: "Dal form", email: "conc@vers.it", version: String((await K.getContact(cc)).version), owner_user_id: "u-ex" }))).error ?? "", /responsabile/i, "a former member cannot be newly assigned");
  assert.match((await A.panelOwnerAction({}, form({ id: ex, version: String(exc.version - 1), owner_user_id: "u-mail" }))).error ?? "", /modificato/);
  assert.ok((await A.panelOwnerAction({}, form({ id: ex, version: String(exc.version), owner_user_id: "u-mail" }))).ok, "explicit reassignment works");
  exc = await K.getContact(ex);
  assert.equal(exc.ownerUserId, "u-mail");
  assert.match((await A.panelOwnerAction({}, form({ id: ex, version: String(exc.version), owner_user_id: "u-ex" }))).error ?? "", /responsabile/i, "no way back to a former member");
  console.log("ok offboarding owner");

  // 9. Panel quick actions: permissions, versions, legacy follow-up only.
  v = (await K.getContact(cc)).version;
  assert.match((await A.panelStageAction({}, form({ id: cc, stage: "preventivo", version: String(v + 3) }))).error ?? "", /modificato/);
  assert.ok((await A.panelStageAction({}, form({ id: cc, stage: "preventivo", version: String(v) }))).ok);
  v = (await K.getContact(cc)).version;
  assert.match((await A.panelFollowUpAction({}, form({ id: cc, version: String(v), next_action_at: "domani" }))).error ?? "", /Data/);
  assert.ok((await A.panelFollowUpAction({}, form({ id: cc, version: String(v), next_action_at: tmw }))).ok);
  let ccRow = await K.getContact(cc);
  assert.equal(ccRow.nextActionAt, tmw); assert.equal(ccRow.nextAction, "Ricontattare", "date alone gets a default text");
  assert.ok((await A.panelFollowUpAction({}, form({ id: cc, version: String(ccRow.version), clear: "1", next_action: "x", next_action_at: tmw }))).ok);
  ccRow = await K.getContact(cc);
  assert.equal(ccRow.nextActionAt, null); assert.equal(ccRow.nextAction, null, "clear removes the follow-up");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE '%task%'")).rows[0].n), 0, "no task tables");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_activities")).rows[0].n), 0, "stage, meet and follow-up create no activity");
  const owned = await K.createContact({ businessName: "Solo responsabile", email: "solo.resp@solo-resp.test", source: "manuale", stage: "contattato", ownerUserId: "u-sales" }, "u-sales");
  const ownedRow = await K.getContact(owned.id);
  assert.equal(ownedRow.stage, "contattato");
  assert.equal((await K.contactTouches([owned.id])).size, 0, "the owner is not the author of a send");
  await db().execute({ sql: "INSERT INTO crm_outreach (contact_id, last_sent_at, last_sent_by) VALUES (?, '2026-11-02T09:00:00.000Z', 'u-sales')", args: [owned.id] });
  const touch = (await K.contactTouches([owned.id])).get(owned.id);
  assert.equal(touch.name, "Utente u-sales");
  assert.equal(JSON.stringify(touch).includes("@"), false);
  const beforeDeals = Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n);
  await signIn("u-sales");
  const movedContact = await A.moveStageAction(owned.id, "call", ownedRow.version);
  assert.match(movedContact.ok ?? "", /Call/);
  assert.equal((await K.getContact(owned.id)).stage, "call");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n), beforeDeals, "the contact board move creates no opportunity");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n), 0, "ingest, stage, meet and follow-up create no deal");
  await signIn("u-pm");
  for (const fn of [A.panelStageAction, A.panelFollowUpAction, A.panelOwnerAction]) await assert.rejects(() => fn({}, form({ id: cc, version: "1" })), /unauthorized/);
  console.log("ok panel actions");

  // 10. Bulk changes: version per contact, partial results reported, permissions, no email.
  await signIn("u-sales");
  const mk = async (n) => (await K.createContact({ businessName: `Massa ${n}`, email: `massa.test${n}@gmail.com`, source: "manuale" }, null)).id;
  const [b1, b2] = [await mk(1), await mk(2)];
  const stale = { id: b2, version: (await K.getContact(b2)).version };
  await K.setStage(b2, "contattato");
  const sentBefore = sent.length;
  const res1 = await A.bulkContactsAction([{ id: b1, version: (await K.getContact(b1)).version }, stale, { id: "00000000-0000-0000-0000-000000000000", version: 1 }], { kind: "owner", owner: "u-mail" });
  assert.deepEqual({ updated: res1.updated, changed: res1.changed, missing: res1.missing }, { updated: 1, changed: 1, missing: 1 }, JSON.stringify(res1));
  assert.match(res1.ok ?? "", /1 aggiornati.*1 modificati da altri.*1 non trovati/);
  assert.equal((await K.getContact(b1)).ownerUserId, "u-mail");
  assert.equal((await K.getContact(b2)).ownerUserId, null, "changed-meanwhile contact left alone");
  const res2 = await A.bulkContactsAction([{ id: b1, version: (await K.getContact(b1)).version }, { id: b2, version: (await K.getContact(b2)).version }], { kind: "stage", stage: "call" });
  assert.equal(res2.updated, 2);
  assert.ok(["call"].includes((await K.getContact(b1)).stage) && (await K.getContact(b2)).stage === "call");
  const res3 = await A.bulkContactsAction([{ id: b1, version: (await K.getContact(b1)).version }], { kind: "followup", at: tmw, text: null });
  assert.equal(res3.updated, 1); assert.equal((await K.getContact(b1)).nextActionAt, tmw);
  assert.equal(sent.length, sentBefore, "bulk actions never send email");
  assert.match((await A.bulkContactsAction([], { kind: "stage", stage: "call" })).error ?? "", /Seleziona/);
  assert.match((await A.bulkContactsAction(Array.from({ length: 101 }, () => ({ id: b1, version: 1 })), { kind: "stage", stage: "call" })).error ?? "", /Massimo 100/);
  assert.match((await A.bulkContactsAction([{ id: b1, version: 1 }], { kind: "stage", stage: "boh" })).error ?? "", /Fase/);
  assert.match((await A.bulkContactsAction([{ id: b1, version: 1 }], { kind: "owner", owner: "u-pm" })).error ?? "", /responsabile/i);
  assert.match((await A.bulkContactsAction([{ id: b1, version: 1 }], { kind: "owner", owner: "u-ex" })).error ?? "", /responsabile/i, "bulk cannot assign a former member");
  assert.match((await A.bulkContactsAction([{ id: "not-an-id", version: 1 }], { kind: "stage", stage: "call" })).error ?? "", /non valida/);
  assert.match((await A.bulkContactsAction([{ id: b1, version: 1 }], { kind: "followup", at: "2026-13-45x", text: null })).error ?? "", /Data/);
  const audit = (await db().execute({ sql: "SELECT action, details FROM audit_log WHERE target_id = ? ORDER BY id", args: [b1] })).rows;
  assert.ok(audit.some((r) => r.action === "crm.owner" && JSON.parse(String(r.details)).bulk === true), "one audit entry per contact");
  const hist = await K.contactHistory(b1);
  assert.deepEqual(hist.map((e) => e.action).sort(), ["crm.followup_set", "crm.owner", "crm.stage"], "contact history from the audit log");
  await signIn("u-pm");
  await assert.rejects(() => A.bulkContactsAction([{ id: b1, version: 1 }], { kind: "stage", stage: "perso" }), /unauthorized/);
  globalThis.__jar.clear();
  console.log("ok bulk actions");

  // 11. Rubrica list on the server: count, owner filter, sort, pages, KPIs.
  const all = await K.listContacts({ limit: 1000 });
  assert.equal(await K.countContacts({}), all.length);
  assert.equal(await K.countContacts({ owner: "none" }), all.filter((c) => !c.ownerUserId).length);
  assert.ok((await K.listContacts({ owner: "u-mail" })).every((c) => c.ownerUserId === "u-mail"));
  const byName = await K.listContacts({ sort: "nome", dir: "asc", limit: 1000 });
  assert.deepEqual(byName.map((c) => c.businessName), [...byName.map((c) => c.businessName)].sort((x, y) => x.localeCompare(y, "en", { sensitivity: "base" })), "sort by name");
  const p1 = await K.listContacts({ sort: "nome", dir: "asc", limit: 3, offset: 0 }), p2 = await K.listContacts({ sort: "nome", dir: "asc", limit: 3, offset: 3 });
  assert.equal(p1.length, 3); assert.ok(!p1.some((c) => p2.some((d) => d.id === c.id)), "pages do not overlap");
  const byScore = await K.listContacts({ sort: "punteggio", dir: "desc", limit: 1000 });
  assert.ok(byScore.every((c, i) => i === 0 || (byScore[i - 1].score ?? -1) >= (c.score ?? -1)));
  const rs = await K.rubricaStats(today);
  assert.equal(rs.total, Number((await db().execute("SELECT COUNT(*) AS n FROM crm_contacts WHERE archived = 0")).rows[0].n));
  assert.equal(rs.inDeal, all.filter((c) => c.stage === "call" || c.stage === "preventivo").length);
  console.log("ok rubrica list");

  // 12. URL state of the rubrica and saved views (metadata only).
  const uuid = "123e4567-e89b-42d3-a456-426614174000";
  const q = N.parseRubricaQuery(new URLSearchParams(`fase=call&q=Mario&p=3&c=${uuid}&tab=note&ordina=nome`));
  assert.equal(q.dir, "asc", "name sorts A-Z by default"); assert.equal(q.p, 3); assert.equal(q.c, uuid); assert.equal(q.tab, "note");
  const bad = N.parseRubricaQuery({ c: "../x", tab: "admin", resp: "a b", ordina: "password", p: "-4", dir: "sideways" });
  assert.deepEqual([bad.c, bad.tab, bad.resp, bad.ordina, bad.p, bad.dir], ["", "dettagli", "", "aggiornato", 1, "desc"], "invalid params fall back to defaults");
  assert.equal(N.rubricaSearch(q, { c: "" }), "?q=Mario&fase=call&ordina=nome&dir=asc&p=3", "closing the panel keeps filters, sort and page");
  assert.equal(N.rubricaSearch(q, { c: uuid, tab: "dettagli" }), `?q=Mario&fase=call&ordina=nome&dir=asc&p=3&c=${uuid}`);
  assert.equal(N.rubricaSearch(N.parseRubricaQuery({})), "", "defaults give a clean URL");
  assert.equal(N.rubricaSearch(N.parseRubricaQuery({ tab: "note" })), "", "no tab without an open contact");
  assert.equal(N.savedViewParams(`q=mario%40rossi.it&c=${uuid}&p=4&fase=call&citta=Alba&resp=me&ordina=punteggio&dir=desc`), "fase=call&citta=Alba&resp=me&ordina=punteggio&dir=desc", "saved views drop search text, contact and page");
  assert.notEqual(N.savedViewsKey("u-sales"), N.savedViewsKey("u-mail"), "views are per user");
  console.log("ok rubrica url state");

  // 13. Radar reads the ingest's own rows: no new tables, nothing rewritten, no automatic opportunity.
  const tables = async () => (await db().execute("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")).rows.map((r) => String(r.name));
  const snapshot = async () => JSON.stringify([(await db().execute("SELECT * FROM crm_contacts ORDER BY id")).rows, (await db().execute("SELECT * FROM crm_drafts ORDER BY id")).rows]);
  const tablesBefore = await tables();
  assert.ok(!tablesBefore.some((t) => /prospect/i.test(t)), "no separate prospect table");
  const dealsBefore = Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n);
  const activitiesBefore = Number((await db().execute("SELECT COUNT(*) AS n FROM crm_activities")).rows[0].n);
  const iris = { contacts: [
    { business_name: "Cantina Alta (test)", email: "alta.test@gmail.com", city: "Alba", region: "CN", type: "Cantina", score: 95, score_reasons: ["Sito non responsive", "Nessun e-commerce"], draft: { subject: "Proposta", body_text: "Ciao" } },
    { business_name: "Cantina Media (test)", email: "media.test@gmail.com", city: "Bra", score: 50, score_reasons: ["Sito datato"] },
    { business_name: "Agriturismo Zero (test)", email: "zero.test@gmail.com", city: "Alba" },
  ] };
  const r13 = await (await call(`Bearer ${secret}`, iris)).json();
  assert.deepEqual([r13.inserted, r13.duplicates, Object.keys(r13).sort()], [3, 0, ["duplicates", "ids", "inserted"]], "same ingest contract");
  const [alta, media, zero] = r13.ids;
  assert.deepEqual(await tables(), tablesBefore, "ingest and Radar create no tables");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n), dealsBefore, "ingest creates no deal");
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_activities")).rows[0].n), activitiesBefore, "ingest creates no activity");
  const seen = await snapshot();
  const RS = await K.radarStats();
  const radarAll = await K.listContacts({ source: "radar", limit: 1000 });
  const radarDrafts = await K.listDrafts(radarAll.map((c) => c.id));
  assert.deepEqual(RS, {
    total: radarAll.length, toReview: radarAll.filter((c) => c.stage === "nuovo").length,
    priority: radarAll.filter((c) => c.stage === "nuovo" && (c.score ?? 0) >= 70).length,
    draftsReady: radarDrafts.filter((d) => d.status === "bozza").length, inDeal: radarAll.filter((c) => c.stage === "call" || c.stage === "preventivo").length,
  }, "radar KPIs match the rows");
  const band = async (f) => (await K.listContacts({ source: "radar", limit: 1000, ...f })).map((c) => c.id);
  assert.ok((await band({ scoreMin: 70, scoreMax: 100 })).includes(alta) && !(await band({ scoreMin: 70, scoreMax: 100 })).includes(media), "alta band");
  assert.ok((await band({ scoreMin: 40, scoreMax: 69 })).includes(media), "media band");
  assert.deepEqual((await band({ noScore: true })).filter((id) => id === zero), [zero], "no-score band");
  assert.equal(await K.countContacts({ source: "radar", noScore: true }), radarAll.filter((c) => c.score === null).length);
  const rf = await K.facets("radar");
  assert.ok(rf.cities.includes("Bra") && rf.cities.every((x) => radarAll.some((c) => c.city === x)), "facets scoped to the Radar");
  await K.facets(); await K.countContacts({ source: "radar", scoreMin: 0, scoreMax: 100 });
  assert.equal(await snapshot(), seen, "Radar reads never rewrite prospects or drafts");
  const hot = radarAll.find((c) => c.id === alta);
  assert.equal(hot.stage, "nuovo", "a high score moves nothing by itself"); assert.equal(hot.valueEur, null, "no deal value from the score");
  assert.equal((await K.listDrafts([alta]))[0].status, "bozza", "ingest drafts wait for a human");
  assert.deepEqual(await K.setStage(alta, "contattato"), { from: "nuovo" });
  const resent = await (await call(`Bearer ${secret}`, { contacts: [{ business_name: "Cantina Alta rinominata", email: "ALTA.test@gmail.com", score: 10, score_reasons: ["altro"] }] })).json();
  assert.deepEqual([resent.inserted, resent.duplicates, resent.ids[0]], [0, 1, alta], "re-sent prospect dedupes onto the saved one");
  const kept = await K.getContact(alta);
  assert.deepEqual([kept.businessName, kept.score, kept.stage, kept.scoreReasons], ["Cantina Alta (test)", 95, "contattato", ["Sito non responsive", "Nessun e-commerce"]], "saved prospects are not changed by a later ingest");
  assert.equal((await K.listContacts({ q: "Cantina Alta" })).length, 1, "and stay a single Rubrica contact");
  const radarPage = readFileSync("app/admin/(shell)/crm/radar/page.tsx", "utf8");
  assert.match(radarPage, /requireSection\("crm"\)/, "Radar page needs the crm section");
  assert.ok(!/crm-actions|sendDraftAction|sendAllowed/.test(radarPage), "Radar sends only through the shared draft editor");
  console.log("ok radar ingest compat");

  // 14. Radar URL state.
  const rq = N.parseRadarQuery(new URLSearchParams(`prio=alta&fase=nuovo&c=${uuid}`));
  assert.deepEqual([rq.prio, rq.ordina, rq.dir, rq.tab], ["alta", "punteggio", "desc", "analisi"], "best score first, panel on the Iris analysis");
  assert.equal(N.radarSearch(rq), `?fase=nuovo&c=${uuid}&prio=alta`);
  assert.equal(N.radarSearch(rq, { tab: "note" }), `?fase=nuovo&c=${uuid}&prio=alta&tab=note`);
  assert.equal(N.radarSearch(rq, { c: "" }), "?fase=nuovo&prio=alta", "closing the panel keeps the filters");
  assert.equal(N.radarSearch(N.parseRadarQuery({})), "", "defaults give a clean URL");
  assert.equal(N.radarSearch(N.parseRadarQuery({ ordina: "aggiornato" })), "?ordina=aggiornato&dir=desc", "the Rubrica default is explicit here");
  const rbad = N.parseRadarQuery({ prio: "urgente", tab: "admin", c: "../x" });
  assert.deepEqual([rbad.prio, rbad.tab, rbad.c], ["", "analisi", ""], "invalid Radar params fall back");
  assert.equal(N.parseRadarQuery({ iris: "si" }).iris, "si");
  assert.equal(N.parseRadarQuery({ iris: "../x" }).iris, "", "iris filter rejects a path");
  assert.equal(N.radarSearch(N.parseRadarQuery({ iris: "si" })), "?iris=si");
  console.log("ok radar url state");

  // 15. Rubrica: next action, kind, saved views, batch permissions.
  const NX = await import("../lib/crm-next.ts");
  const KK = await import("../lib/crm-kind.ts");
  const day = "2026-11-09";
  const late = NX.pickNextTouch([
    { title: "Dopo", at: "2026-11-12", source: "followup" },
    { title: "Scaduta", at: "2026-11-01", time: "09:00", source: "attivita" },
  ], day);
  assert.equal(late.title, "Scaduta");
  assert.equal(late.overdue, true);
  assert.match(late.relative, /giorni fa/);
  const sooner = NX.pickNextTouch([
    { title: "Giorno", at: "2026-11-09", source: "followup" },
    { title: "Ore", at: "2026-11-09", time: "10:00", source: "attivita" },
  ], day);
  assert.equal(sooner.title, "Ore", "a time the same day is earlier than an undated follow-up");
  assert.equal(sooner.relative, "Oggi");
  assert.equal(sooner.overdue, false);
  assert.equal(NX.pickNextTouch([{ title: "Senza data", at: "", source: "followup" }], day), null);
  const nx = await K.createContact({ businessName: "Prossima Azione", email: "prossima.azione@gmail.com", source: "manuale", nextAction: "Richiamare", nextActionAt: "2026-11-20" }, null);
  await db().execute({
    sql: "INSERT INTO crm_activities (id, contact_id, title, kind, due_date, due_time, assignee_user_id, created_by) VALUES ('act-nx', ?, 'Chiamata scaduta', 'call', '2026-11-01', '09:00', 'u-sales', 'u-sales')",
    args: [nx.id],
  });
  const openNx = await K.openActivitiesFor([nx.id, nx.id]);
  const fromDb = NX.pickNextTouch([
    ...(openNx.get(nx.id) ?? []).map((a) => ({ title: a.title, at: a.at, time: a.time, source: "attivita" })),
    { title: "Richiamare", at: "2026-11-20", source: "followup" },
  ], day);
  assert.equal(fromDb.source, "attivita");
  assert.equal(fromDb.overdue, true);
  await db().execute("UPDATE crm_activities SET done_at = '2026-11-09T10:00:00.000Z' WHERE id = 'act-nx'");
  assert.equal((await K.openActivitiesFor([nx.id])).has(nx.id), false, "a completed activity leaves the next action");
  console.log("ok next action");

  assert.equal(KK.resolveKind({ businessName: "Anna Neri", contactName: "Anna Neri", type: null, kind: null }), "persona");
  assert.equal(KK.resolveKind({ businessName: "Ottica Bianchi", contactName: "Luca Bianchi", type: "Ottica", kind: null }), "azienda");
  assert.equal(KK.resolveKind({ businessName: "Solo Nome", contactName: null, type: null, kind: null }), "azienda");
  assert.equal(KK.resolveKind({ businessName: "Anna Neri", contactName: "Anna Neri", type: null, kind: "azienda" }), "azienda", "a stored kind wins");
  const person = await K.createContact({ businessName: "Giulia Verdi", contactName: "Giulia Verdi", source: "manuale" }, null);
  const company = await K.createContact({ businessName: "Falegnameria Verdi", contactName: "Marco Verdi", type: "Legno", source: "manuale" }, null);
  assert.ok((await K.listContacts({ kind: "persona", q: "Giulia Verdi" })).some((c) => c.id === person.id));
  assert.ok((await K.listContacts({ kind: "azienda", q: "Falegnameria Verdi" })).some((c) => c.id === company.id));
  assert.equal((await K.listContacts({ kind: "persona", q: "Falegnameria Verdi" })).length, 0);
  const segs = await K.rubricaSegments();
  assert.equal(segs.aziende + segs.persone, segs.tutti, "every open contact is an azienda or a persona");
  await signIn("u-sales");
  const personRow = await K.getContact(person.id);
  assert.match((await A.setKindAction(person.id, "azienda", personRow.version)).ok ?? "", /azienda/);
  assert.equal((await K.getContact(person.id)).kind, "azienda");
  assert.ok((await K.listContacts({ kind: "azienda", q: "Giulia Verdi" })).some((c) => c.id === person.id), "an explicit kind replaces the deduction");
  console.log("ok contact kind");

  await addUser("u-founder", ["founder"], true);
  await db().execute("INSERT INTO admin_2fa (user_id, secret_enc, enabled_at) VALUES ('u-founder', 'test-secret', strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
  const VA = await import("../app/admin/crm-view-actions.ts");
  await signIn("u-sales");
  assert.match((await VA.createViewAction("Langhe", "seg=aziende&q=mario&vista=griglia", true)).error ?? "", /founder/);
  assert.match((await VA.createViewAction("L", "seg=aziende", false)).error ?? "", /2 e 40/);
  const made = await VA.createViewAction("Langhe", `seg=aziende&q=mario%40rossi.it&vista=griglia&ordina=nome&dir=asc&c=${uuid}&p=4`, false);
  assert.equal(made.ok, true);
  const ownViews = await (await import("../lib/crm-views.ts")).listSavedViews("u-sales");
  assert.equal(ownViews.length, 1);
  assert.match(ownViews[0].params, /q=mario/);
  assert.match(ownViews[0].params, /seg=aziende/);
  assert.match(ownViews[0].params, /vista=griglia/);
  assert.equal(ownViews[0].params.includes("c="), false);
  assert.equal(/(^|&)p=/.test(ownViews[0].params), false);
  assert.equal(ownViews[0].shared, false);
  await signIn("u-mail");
  assert.match((await VA.deleteViewAction(ownViews[0].id)).error ?? "", /tue viste/);
  assert.match((await VA.renameViewAction(ownViews[0].id, "Altro nome")).error ?? "", /tue viste/);
  assert.equal((await (await import("../lib/crm-views.ts")).listSavedViews("u-mail")).length, 0);
  await signIn("u-founder");
  assert.equal((await VA.createViewAction("Team Langhe", "seg=persone&fase=nuovo", true)).ok, true);
  const sharedId = (await (await import("../lib/crm-views.ts")).listSavedViews("u-founder")).find((v) => v.name === "Team Langhe").id;
  await signIn("u-mail");
  const sharedSeen = await (await import("../lib/crm-views.ts")).listSavedViews("u-mail");
  assert.ok(sharedSeen.some((v) => v.id === sharedId && v.shared && !v.mine));
  assert.match((await VA.deleteViewAction(sharedId)).error ?? "", /tue viste/, "a commerciale cannot delete a shared view");
  await signIn("u-founder");
  assert.equal((await VA.renameViewAction(sharedId, "Team Alba")).ok, true);
  assert.equal((await VA.deleteViewAction(sharedId)).ok, true);
  await signIn("u-sales");
  assert.equal((await VA.renameViewAction(ownViews[0].id, "Langhe mie")).ok, true);
  assert.equal((await VA.deleteViewAction(ownViews[0].id)).ok, true);
  await signIn("u-pm");
  await assert.rejects(() => VA.createViewAction("No", "seg=tutti", false), /unauthorized/);
  console.log("ok saved views");

  await signIn("u-sales");
  const held = await K.createContact({ businessName: "Gia in call", email: "gia.call@gmail.com", source: "manuale", stage: "call" }, null);
  const heldVersion = (await K.getContact(held.id)).version;
  const heldRes = await A.bulkContactsAction([{ id: held.id, version: heldVersion }], { kind: "stage", stage: "call" });
  assert.equal(heldRes.updated, 1);
  assert.equal((await K.getContact(held.id)).version, heldVersion, "an unchanged stage does not bump the version");
  const pair = [
    await K.createContact({ businessName: "Batch Uno", email: "batch.uno@gmail.com", source: "manuale" }, null),
    await K.createContact({ businessName: "Batch Due", email: "batch.due@gmail.com", source: "manuale" }, null),
  ];
  const assigned = await A.bulkContactsAction(await Promise.all(pair.map(async (c) => ({ id: c.id, version: (await K.getContact(c.id)).version }))), { kind: "owner", owner: "u-sales" });
  assert.equal(assigned.updated, 2);
  for (const c of pair) assert.equal((await K.getContact(c.id)).ownerUserId, "u-sales");
  await signIn("u-pm");
  await assert.rejects(() => A.bulkContactsAction([{ id: pair[0].id, version: 1 }], { kind: "owner", owner: "u-sales" }), /unauthorized/);
  console.log("ok rubrica batch");

  const pipe = await K.createContact({ businessName: "Pipeline Sposta", email: "pipeline.sposta@gmail.com", source: "manuale" }, null);
  const pipeRow = await K.getContact(pipe.id);
  await signIn("u-pm");
  await assert.rejects(() => A.moveStageAction(pipe.id, "call", pipeRow.version), /unauthorized/, "drag uses the same permission as the stage menu");
  await assert.rejects(() => A.setEstimateAction(pipe.id, "3000", "", pipeRow.version), /unauthorized/);
  await signIn("u-sales");
  const dragStale = await A.moveStageAction(pipe.id, "call", pipeRow.version + 9);
  assert.match(dragStale.error ?? "", /modificato/, "a stale drag does not write");
  const afterStale = await K.getContact(pipe.id);
  assert.equal(afterStale.stage, "nuovo");
  assert.equal(afterStale.version, pipeRow.version, "failed drag rolls the row back");
  const saved = await A.setEstimateAction(pipe.id, "4500", "Sito", pipeRow.version);
  assert.equal(saved.ok, "Valore stimato salvato.");
  assert.equal((await K.getContact(pipe.id)).estimatedValueCents, 450000);
  assert.equal((await A.setEstimateAction(pipe.id, "4500", "Sito", pipeRow.version)).error?.length > 0, true, "a second save with the old version does not overwrite");

  const stima = await (await call(`Bearer ${secret}`, { contacts: [{ business_name: "Stima Nuova", email: "stima.nuova@gmail.com", estimatedValue: 3000, estimatedValueNote: "Prenotazioni" }] })).json();
  assert.equal(stima.inserted, 1);
  const stimaId = stima.ids[0];
  assert.equal((await K.getContact(stimaId)).estimatedValueCents, 300000);
  assert.equal((await K.getContact(stimaId)).estimatedValueNote, "Prenotazioni");
  await db().execute({ sql: "UPDATE crm_contacts SET estimated_value_cents = 1000, estimated_value_note = 'gia' WHERE id = ?", args: [stimaId] });
  const dupIngest = await (await call(`Bearer ${secret}`, { contacts: [{ business_name: "Stima Nuova", email: "stima.nuova@gmail.com", estimatedValue: 9000, estimatedValueNote: "altro" }] })).json();
  assert.equal(dupIngest.duplicates, 1);
  assert.equal((await K.getContact(stimaId)).estimatedValueCents, 1000, "a duplicate ingest does not touch the estimate");
  assert.equal((await K.getContact(stimaId)).estimatedValueNote, "gia");
  assert.equal((await call(`Bearer ${secret}`, { contacts: [{ business_name: "Troppo", email: "troppo.valore@gmail.com", estimatedValue: 100001 }] })).status, 400);
  assert.equal((await K.listContacts({ q: "Troppo" })).length, 0, "an out of range estimate creates nothing");
  const zeroStima = await (await call(`Bearer ${secret}`, { contacts: [{ business_name: "Zero Stima", email: "zero.stima@gmail.com", estimatedValue: 0 }] })).json();
  assert.equal(zeroStima.inserted, 1);
  assert.equal((await K.getContact(zeroStima.ids[0])).estimatedValueCents, 0, "zero is a real estimate");

  const KpiPipe = await import("../lib/crm-kpi.ts");
  assert.equal(KpiPipe.kpiChange(12, null), null);
  assert.equal(KpiPipe.kpiChange(null, 4), null);
  assert.equal(KpiPipe.kpiChange(8, 0), null, "no percentage when the past point is zero");
  await db().execute("DELETE FROM crm_kpi_daily WHERE day IN ('2026-01-01', '2026-01-08')");
  assert.equal(await KpiPipe.kpiWeekChange("potential_value_cents", "2026-01-08"), null, "no percentage without history");
  await db().execute("INSERT INTO crm_kpi_daily (day, contacts_contacted, potential_value_cents) VALUES ('2026-01-01', 4, NULL), ('2026-01-08', 6, 1000)");
  assert.equal(await KpiPipe.kpiWeekChange("potential_value_cents", "2026-01-08"), null, "a missing past potential is not a percentage");
  assert.equal(await KpiPipe.kpiWeekChange("contacts_contacted", "2026-01-08"), 50);
  console.log("ok pipeline");

  // 16. Iris search requests: daily credit in Rome, one active request, 3h expiry, founder gate, callback, ingest link.
  const Core = await import("../lib/crm-iris-core.ts");
  assert.equal(Core.irisTransition("queued", "working"), "ok");
  assert.equal(Core.irisTransition("working", "queued"), "reject");
  assert.equal(Core.irisTransition("queued", "ready"), "ok");
  assert.equal(Core.irisTransition("working", "error"), "ok");
  assert.equal(Core.irisTransition("ready", "error"), "reject");
  assert.equal(Core.irisTransition("error", "working"), "reject");
  assert.equal(Core.irisTransition("ready", "ready"), "same");
  assert.equal(Core.irisWebhookHeaders("hook-key", undefined).Authorization, "Bearer hook-key");
  assert.equal(Core.irisWebhookHeaders("hook-key", "X-Iris-Key")["X-Iris-Key"], "hook-key");
  assert.equal(Core.irisWebhookHeaders("hook-key", "Bad Header"), null);
  assert.equal(Core.romeClock("2026-11-09T09:42:00.000Z"), "10:42");
  const params = { zone: "Alba, Cuneo", sectors: ["cantine", "Cantine"], count: 30, siteCriteria: ["datato", "datato"], notes: "sala" };
  assert.deepEqual(Core.irisParamsSchema.parse(params).sectors, ["cantine"]);
  assert.equal(Core.irisParamsSchema.safeParse({ ...params, count: 9 }).success, false);
  assert.equal(Core.irisParamsSchema.safeParse({ ...params, notes: "x".repeat(1001) }).success, false);

  const IR = await import("../lib/crm-iris.ts");
  await addUser("u-michel", ["founder"], true);
  await addUser("u-caleb", ["founder"], true);
  await db().execute({ sql: "UPDATE admin_users SET name = 'Michel Branche' WHERE id = 'u-michel'" });
  await db().execute({ sql: "UPDATE admin_users SET name = 'Caleb' WHERE id = 'u-caleb'" });
  const posted = [];
  const okFetch = async (url, init) => { posted.push({ url, body: JSON.parse(init.body), headers: init.headers }); return new Response(null, { status: 204 }); };
  process.env.CRM_IRIS_WEBHOOK_URL = "https://iris.example/hook";
  process.env.CRM_IRIS_WEBHOOK_KEY = "hook-key";
  delete process.env.CRM_IRIS_WEBHOOK_HEADER;
  const ask = (userId, name, now, fetchImpl = okFetch) => IR.requestIrisSearch({ userId, name, founder: true, params, now, origin: "http://t", fetchImpl });

  const denied = await IR.requestIrisSearch({ userId: "u-sales", name: "Vendite", founder: false, params, origin: "http://t", fetchImpl: okFetch });
  assert.equal(denied.status, 403);
  assert.equal(posted.length, 0, "a refused request does not call Iris");

  const failFetch = async () => { throw new Error("down"); };
  const httpFail = async () => new Response("no", { status: 502 });
  const tHung = new Date("2026-07-09T08:00:00.000Z");
  const hung = await ask("u-michel", "Michel Branche", tHung);
  assert.equal(hung.ok, true, JSON.stringify(hung));
  await IR.applyIrisStatus(hung.id, { status: "working" }, tHung);
  const tExact = new Date(tHung.getTime() + 3 * 60 * 60 * 1000);
  assert.equal((await IR.currentIrisNotice(tExact)).phase, "working");
  assert.equal((await ask("u-caleb", "Caleb", tExact)).status, 409, "exactly 3 hours is still active");
  const tStale = new Date(tExact.getTime() + 1);
  const irisStale = await IR.currentIrisNotice(tStale);
  assert.equal(irisStale.phase, "expired");
  assert.equal(irisStale.blocked, false);
  const unlocked = await ask("u-michel", "Michel Branche", tStale);
  assert.equal(unlocked.ok, true, "after 3 hours the stuck request no longer blocks and the day's credit is back");
  await IR.applyIrisStatus(unlocked.id, { status: "error", error_message: "annullata" }, tStale);

  const julyEarly = new Date("2026-07-09T20:00:00.000Z");
  const summer = await ask("u-caleb", "Caleb", julyEarly);
  assert.equal(summer.ok, true, JSON.stringify(summer));
  await IR.applyIrisStatus(summer.id, { status: "ready", inserted: 1 }, julyEarly);
  assert.equal((await ask("u-caleb", "Caleb", new Date("2026-07-09T21:30:00.000Z"))).status, 429, "20:00Z and 21:30Z are the same July day in Rome");
  const julyNext = new Date("2026-07-09T22:30:00.000Z");
  const summerNext = await ask("u-caleb", "Caleb", julyNext);
  assert.equal(summerNext.ok, true, "22:30Z is the next Rome day in July");
  await IR.applyIrisStatus(summerNext.id, { status: "error", error_message: "no" }, julyNext);
  const rejected = await ask("u-michel", "Michel Branche", julyNext, httpFail);
  assert.equal(rejected.status, 502);
  const failed = await ask("u-michel", "Michel Branche", julyNext, failFetch);
  assert.equal(failed.status, 502);
  const recovered = await ask("u-michel", "Michel Branche", julyNext);
  assert.equal(recovered.ok, true, "a failed webhook gives the day's credit back");
  await IR.applyIrisStatus(recovered.id, { status: "ready", inserted: 0 }, julyNext);

  const t0 = new Date("2026-11-09T09:42:00.000Z");
  const caleb = await ask("u-caleb", "Caleb", t0);
  assert.equal(caleb.ok, true, JSON.stringify(caleb));
  const irisPost = posted.at(-1);
  assert.equal(irisPost.headers.Authorization, "Bearer hook-key");
  assert.equal(irisPost.body.requestedBy.name, "Caleb");
  assert.equal(irisPost.body.requestId, caleb.id);
  assert.equal(irisPost.body.statusUrl, `http://t/api/crm/iris-requests/${caleb.id}/status`);
  assert.equal(irisPost.body.ingestUrl, "http://t/api/crm/ingest");
  assert.deepEqual(irisPost.body.siteCriteria, ["datato"]);
  assert.equal(irisPost.body.notes, "sala");
  assert.equal(irisPost.body.count, 30);
  const overlap = await ask("u-michel", "Michel Branche", t0);
  assert.equal(overlap.status, 409, "one active request for the agency");
  await IR.applyIrisStatus(caleb.id, { status: "working" }, t0);
  const working = await IR.currentIrisNotice(t0);
  assert.equal(working.name, "Caleb");
  assert.equal(working.time, "10:42");
  assert.equal(working.blocked, true);
  assert.equal(Core.irisNoticeText(working), "Ricerca già richiesta da Caleb alle 10:42 (in lavorazione). Attendi almeno 60 minuti e verifica in Radar se i lead sono già stati uniti.");
  assert.deepEqual([working.zone, working.sectors], ["Alba, Cuneo", ["cantine"]]);

  const { POST: statusPost, PATCH: statusPatch } = await import("../app/api/crm/iris-requests/[id]/status/route.ts");
  const statusCall = (method, id, auth, body) => (method === "PATCH" ? statusPatch : statusPost)(
    new Request("http://t/status", { method, headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
  assert.equal((await statusCall("POST", caleb.id, null, { status: "ready" })).status, 401);
  const savedSecret = process.env.CRM_INGEST_SECRET;
  delete process.env.CRM_INGEST_SECRET;
  assert.equal((await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "ready" })).status, 503);
  process.env.CRM_INGEST_SECRET = savedSecret;
  assert.equal((await statusCall("POST", caleb.id, "Bearer wrong-wrong-wrong-wrong", { status: "working" })).status, 401);
  assert.equal((await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "queued" })).status, 400);
  assert.equal((await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "working" })).status, 200, "repeating working is idempotent");
  assert.equal((await statusCall("PATCH", caleb.id, `Bearer ${secret}`, { status: "queued" })).status, 400);
  const readyRes = await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "ready", inserted: 12, duplicates: 3 });
  assert.equal(readyRes.status, 200);
  assert.equal((await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "ready", inserted: 12 })).status, 200);
  assert.equal((await statusCall("POST", caleb.id, `Bearer ${secret}`, { status: "error" })).status, 409);
  const readyNotice = await IR.currentIrisNotice(new Date(t0.getTime() + 60_000));
  assert.equal(readyNotice.phase, "ready");
  assert.equal(readyNotice.blocked, false);
  assert.equal(Core.irisNoticeText(readyNotice), "Pronta: 12 lead aggiunti");

  assert.equal((await ask("u-caleb", "Caleb", t0)).status, 429, "same Rome day, credit spent");
  const stillMorning = new Date("2026-11-09T22:30:00.000Z");
  assert.equal((await ask("u-caleb", "Caleb", stillMorning)).status, 429, "22:30Z is still 9 November in Rome");
  const romeNext = new Date("2026-11-09T23:30:00.000Z");
  const michel = await ask("u-michel", "Michel Branche", romeNext);
  assert.equal(michel.ok, true, "23:30Z is 10 November in Rome, and the other founder is free");
  assert.equal((await IR.applyIrisStatus(michel.id, { status: "error", error_message: "stop" })).ok, true);
  const retried = await ask("u-michel", "Michel Branche", romeNext);
  assert.equal(retried.ok, true, "an error gives the day's credit back");
  await IR.applyIrisStatus(retried.id, { status: "ready", inserted: 2 }, romeNext);

  delete process.env.CRM_IRIS_WEBHOOK_URL;
  const later = new Date("2026-11-12T12:00:00.000Z");
  const missing = await ask("u-caleb", "Caleb", later);
  assert.equal(missing.status, 502);
  process.env.CRM_IRIS_WEBHOOK_URL = "https://iris.example/hook";
  process.env.CRM_IRIS_WEBHOOK_HEADER = "X-Iris-Key";
  const configured = await ask("u-caleb", "Caleb", later);
  assert.equal(configured.ok, true);
  assert.equal(posted.at(-1).headers["X-Iris-Key"], "hook-key");
  assert.equal(posted.at(-1).headers.Authorization, undefined);

  const linked = await call(`Bearer ${secret}`, { irisRequestId: configured.id, contacts: [
    { business_name: "Cantina Collegata", email: "collegata.iris@gmail.com", city: "Alba" },
    { business_name: "Pizzeria doppione", website: "mario.it" },
  ] });
  assert.equal(linked.status, 200);
  const linkedJson = await linked.json();
  assert.deepEqual(Object.keys(linkedJson).sort(), ["duplicates", "ids", "inserted"]);
  assert.equal(linkedJson.inserted, 1);
  assert.equal(linkedJson.duplicates, 1);
  assert.equal((await K.getContact(linkedJson.ids[0])).irisRequestId, configured.id);
  assert.equal((await K.getContact(a.id)).irisRequestId, null, "a duplicate is not relinked");
  assert.equal((await K.listContacts({ iris: configured.id })).map((c) => c.id).join(), linkedJson.ids[0]);
  await K.setArchived(linkedJson.ids[0], true);
  const archivedDup = await (await call(`Bearer ${secret}`, { irisRequestId: configured.id, contacts: [{ business_name: "Cantina Collegata 2", email: "collegata.iris@gmail.com" }] })).json();
  assert.deepEqual([archivedDup.inserted, archivedDup.duplicates], [0, 1]);
  assert.equal((await K.getContact(linkedJson.ids[0])).businessName, "Cantina Collegata", "an archived duplicate is not rewritten");
  assert.equal((await call(`Bearer ${secret}`, { irisRequestId: "00000000-0000-4000-8000-000000009999", contacts: [{ business_name: "Orfana", email: "orfana.iris@gmail.com" }] })).status, 404);

  await signIn("u-sales");
  const Act = await import("../app/admin/crm-iris-actions.ts");
  const act = await Act.askIrisAction(params);
  assert.match(act.error ?? "", /founder/);
  delete process.env.CRM_IRIS_WEBHOOK_URL;
  delete process.env.CRM_IRIS_WEBHOOK_KEY;
  delete process.env.CRM_IRIS_WEBHOOK_HEADER;
  console.log("ok iris requests");

  console.log("crm: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
