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
for (const k of ["RESEND_API_KEY", "MAIL_FROM", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "AGENCY_IMAP_USER", "AGENCY_IMAP_PASSWORD"]) delete process.env[k];
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
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE '%task%' OR name LIKE '%activit%' OR name LIKE '%opportun%'")).rows[0].n), 0, "no new follow-up, activity or opportunity tables");
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

  console.log("crm: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
