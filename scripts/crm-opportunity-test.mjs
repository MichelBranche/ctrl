/*
 * Opportunities are explicit deals, not contact stages.
 *   node scripts/crm-opportunity-test.mjs
 * Creates nothing from ingest, CSV import, setStage or a saved Meet row. One open deal per contact.
 * A stale version does not write. Won and lost close the deal and leave the contact alone.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-deal-"));
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
    if (spec === "next/server") return { url: "data:text/javascript," + encodeURIComponent("export function after(f){return typeof f==='function'?f():f}"), shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const revalidatePath=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const untouched = ["app/admin/meet-actions.ts", "app/admin/crm-actions.ts", "app/api/crm/ingest/route.ts", "lib/crm-import.ts", "lib/crm.ts", "lib/client-meet.ts"];
for (const file of untouched) {
  const src = readFileSync(file, "utf8");
  assert.equal(src.includes("createOpportunity"), false, file);
  assert.equal(src.includes("crm_opportunities"), false, file);
}

const Core = await import("../lib/crm-core.ts");
const Nav = await import("../lib/crm-nav.ts");
assert.equal(Core.conversionRate(0, 0), null);
assert.equal(Core.conversionRate(1, 1), 0.5);
assert.equal(Nav.pipelinePeriodStart("tutto", new Date("2026-11-07T12:00:00Z")), null);
const month = Nav.pipelinePeriodStart("mese", new Date("2026-11-07T12:00:00Z"));
assert.equal(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", month: "2-digit", day: "2-digit" }).format(new Date(month)), "11/01");
console.log("ok period");

try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((name) => name.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const M = await import("../lib/migrate.ts");
  await M.ensureCrmSchema();
  await M.ensureCrmSchema();
  const K = await import("../lib/crm.ts");
  const O = await import("../lib/crm-opportunity.ts");
  const I = await import("../lib/crm-import.ts");
  const A = await import("../app/admin/crm-opportunity-actions.ts");
  const Meet = await import("../lib/client-meet.ts");
  const { SignJWT } = await import("jose");
  const { dumpDatabase } = await import("../lib/backup-core.ts");

  const count = async () => Number((await db().execute("SELECT COUNT(*) AS n FROM crm_opportunities")).rows[0].n);
  const contact = async (id) => (await db().execute({ sql: "SELECT stage, owner_user_id AS owner, score FROM crm_contacts WHERE id = ?", args: [id] })).rows[0];
  const addUser = async (id, roles) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, 0)", args: [id, `${id}@t.test`, id] });
    for (const role of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, role] });
  };
  const signIn = async (id) => globalThis.__jar.set("ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET)));

  const empty = await O.opportunityTotals();
  assert.equal(empty.open, 0);
  assert.equal(empty.won, 0);
  assert.equal(Core.conversionRate(empty.won, empty.lost), null);
  await addUser("u-sales", ["commerciale"]);
  await addUser("u-pm", ["project_manager"]);

  const beforeImplicit = await count();
  await K.ingestContact({ business_name: "Iris QA", email: "iris.qa@iris-qa.test", score: 88, score_reasons: ["Lento"], city: "Torino" });
  const iris = (await K.listContacts({ q: "Iris QA" }))[0];
  assert.equal(iris.stage, "nuovo", "a new Iris contact lands in Nuovo");
  assert.equal(await count(), beforeImplicit, "Iris does not open a deal");
  await K.setStage(iris.id, "contattato");
  const imported = await I.confirmImport([{ businessName: "Csv Deal QA", email: "csv.deal@csv-deal.test", score: 99, stage: "vinto" }], "u-sales");
  assert.equal(imported.inserted, 1);
  const csv = (await K.listContacts({ q: "Csv Deal QA" }))[0];
  assert.equal(csv.source, "manuale");
  assert.equal(csv.stage, "nuovo");
  assert.equal(csv.score, null);
  await K.setStage(csv.id, "call");
  await Meet.saveClientMeeting({
    id: "00000000-0000-4000-8000-00000000d0e1", contactId: csv.id, clientName: "Csv Deal QA", clientEmail: "csv.deal@csv-deal.test",
    title: "Call", agenda: null, start: "2026-12-01T10:00", minutes: 30, meetUrl: "https://meet.google.com/abc-defg-hij", eventId: null, createdBy: "u-sales",
  });
  assert.equal(await count(), beforeImplicit, "ingest, import, stage and a Meet row create no deal");
  const createdTouch = await K.createContact({ businessName: "Gia Contattato", email: "gia.contattato@gia-contattato.test", source: "manuale", stage: "contattato", ownerUserId: "u-sales" }, "u-sales");
  const touched = await K.getContact(createdTouch.id);
  assert.equal(touched.stage, "contattato", "an existing stage is not reset");
  assert.equal((await K.contactTouches([touched.id, csv.id])).size, 0, "owner and stage are not a send");
  await db().execute({ sql: "INSERT INTO crm_outreach (contact_id, last_sent_at, last_sent_by) VALUES (?, '2026-11-01T10:00:00.000Z', 'u-sales')", args: [touched.id] });
  const who = await K.contactTouches([touched.id]);
  assert.equal(who.get(touched.id)?.name, "u-sales");
  assert.equal(JSON.stringify([...who.values()]).includes("@"), false, "a touch has no email address");
  assert.equal((await K.contactTouches([csv.id])).size, 0, "a contact without a send stays without an author");
  const dealsAfterTouch = await count();
  await K.setStage(touched.id, "call", touched.version);
  assert.equal((await K.getContact(touched.id)).stage, "call");
  assert.equal(await count(), dealsAfterTouch, "moving a contact opens no deal");
  console.log("ok contact board facts");
  assert.equal((await contact(csv.id)).stage, "call");
  console.log("ok no implicit deal");

  const alpha = await K.createContact({ businessName: "Alpha Deal", email: "alpha.deal@alpha-deal.test", city: "Alba", source: "radar", score: 91, scoreReasons: ["Sito lento"], stage: "call", ownerUserId: "u-sales" }, null);
  assert.equal(await count(), 0, "creating a contact in Call opens no deal");
  const first = await O.createOpportunity({ contactId: alpha.id, title: "Sito nuovo", stage: "nuovo", valueEur: 1500.5, ownerUserId: "u-sales", priority: null, idempotencyKey: "key-alpha" }, "u-sales");
  assert.equal(first.created, true);
  const again = await O.createOpportunity({ contactId: alpha.id, title: "Sito nuovo di nuovo", stage: "preventivo", valueEur: 9, ownerUserId: null, priority: "alta", idempotencyKey: "key-alpha" }, "u-sales");
  assert.deepEqual(again, { id: first.id, created: false });
  assert.equal(await count(), 1, "the same key does not insert a second row");
  const blocked = await O.createOpportunity({ contactId: alpha.id, title: "Altra", stage: "nuovo", valueEur: null, ownerUserId: null, priority: null, idempotencyKey: "key-other" }, "u-sales");
  assert.deepEqual(blocked, { error: "open" });
  const deal = await O.getOpportunity(first.id);
  assert.equal(deal.priority, null, "priority is not copied from the Iris score");
  assert.equal(deal.score, 91);
  assert.equal(deal.source, "radar");
  assert.equal(deal.valueEur, 1500.5);
  assert.deepEqual(await contact(alpha.id), { stage: "call", owner: "u-sales", score: 91 });
  console.log("ok explicit create");

  const beta = await K.createContact({ businessName: "Beta Deal", email: "beta.deal@beta-deal.test", source: "manuale", stage: "contattato" }, null);
  const [left, right] = await Promise.all([
    O.createOpportunity({ contactId: beta.id, title: "A", stage: "nuovo", valueEur: null, ownerUserId: null, priority: null, idempotencyKey: null }, "u-sales"),
    O.createOpportunity({ contactId: beta.id, title: "B", stage: "call", valueEur: 2000, ownerUserId: null, priority: "alta", idempotencyKey: null }, "u-sales"),
  ]);
  const won = [left, right].filter((r) => "id" in r);
  assert.equal(won.length, 1);
  assert.equal((await db().execute({ sql: "SELECT COUNT(*) AS n FROM crm_opportunities WHERE contact_id = ?", args: [beta.id] })).rows[0].n, 1);
  assert.equal((await contact(beta.id)).stage, "contattato");
  console.log("ok race");

  assert.equal(await O.moveOpportunity(first.id, "perso", 99), "conflict");
  assert.equal((await O.getOpportunity(first.id)).stage, "nuovo");
  assert.deepEqual(await O.moveOpportunity(first.id, "vinto", 1), { from: "nuovo" });
  const wonDeal = await O.getOpportunity(first.id);
  assert.equal(wonDeal.stage, "vinto");
  assert.ok(wonDeal.closedAt);
  assert.equal((await contact(alpha.id)).stage, "call", "winning a deal does not mark the contact won");
  const second = await O.createOpportunity({ contactId: alpha.id, title: "Seconda", stage: "contattato", valueEur: null, ownerUserId: null, priority: null, idempotencyKey: null }, "u-sales");
  assert.equal(second.created, true);
  assert.equal(await O.moveOpportunity(first.id, "call", 2), "open", "a closed deal stays closed while another is open");
  assert.equal((await O.getOpportunity(first.id)).stage, "vinto");
  assert.deepEqual(await O.moveOpportunity(second.id, "perso", 1), { from: "contattato" });
  assert.equal((await contact(alpha.id)).stage, "call");
  console.log("ok transitions");

  const [moveA, moveB] = await Promise.all([
    O.moveOpportunity(won[0].id, "call", 1),
    O.moveOpportunity(won[0].id, "preventivo", 1),
  ]);
  const moved = [moveA, moveB].filter((r) => typeof r === "object");
  assert.equal(moved.length, 1);
  assert.equal((await O.getOpportunity(won[0].id)).version, 2);
  console.log("ok concurrent move");

  await db().execute({ sql: "UPDATE crm_opportunities SET closed_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", args: [second.id] });
  const monthTotals = await O.opportunityTotals({ period: "mese" });
  assert.equal(monthTotals.won, 1);
  assert.equal(monthTotals.lost, 0, "a deal closed in 2020 is outside this month");
  assert.equal(monthTotals.open, 1);
  assert.equal(monthTotals.openValue, (await O.getOpportunity(won[0].id)).valueEur ?? 0);
  const listed = await O.listOpportunities({ period: "mese" });
  assert.equal(listed.some((d) => d.id === second.id), false);
  assert.equal(listed.some((d) => d.id === won[0].id), true);
  const all = await O.opportunityTotals();
  assert.equal(Core.conversionRate(all.won, all.lost), 0.5);
  console.log("ok totals");

  const beforeDenied = await count();
  await signIn("u-pm");
  await assert.rejects(() => A.createOpportunityAction({ contactId: beta.id, title: "No", stage: "nuovo", valueEur: null, ownerUserId: null, priority: null, idempotencyKey: "pm-key" }), /unauthorized/);
  await assert.rejects(() => A.moveOpportunityAction(first.id, "perso", 2), /unauthorized/);
  assert.equal(await count(), beforeDenied);
  console.log("ok permission");

  await signIn("u-sales");
  const bad = await A.createOpportunityAction({ contactId: beta.id, title: "x", stage: "nuovo" });
  assert.match(bad.error, /nome/);
  const formula = await A.createOpportunityAction({ contactId: csv.id, title: "=cmd|' /C calc'!A0", stage: "nuovo", valueEur: "1.500,50", ownerUserId: "u-sales", priority: null, idempotencyKey: "formula-key" });
  assert.equal(formula.ok, "Opportunità aperta.");
  const stored = await O.getOpportunity(formula.id);
  assert.equal(stored.title, "'=cmd|' /C calc'!A0");
  assert.equal(stored.valueEur, 1500.5);
  assert.equal(stored.priority, null);
  assert.equal((await contact(csv.id)).stage, "call");
  const audit = (await db().execute("SELECT action, details, target_id FROM audit_log WHERE action LIKE 'crm.opportunity%'")).rows.map((r) => ({ action: String(r.action), details: String(r.details), target: String(r.target_id) }));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].target, csv.id);
  assert.equal(audit[0].details.includes("csv.deal"), false);
  assert.equal(audit[0].details.includes("=cmd"), false);
  assert.equal(await O.updateOpportunity(formula.id, { title: "Nome pulito", valueEur: 10, priority: "bassa" }, 1), "ok");
  const edited = await O.getOpportunity(formula.id);
  assert.equal(edited.title, "Nome pulito");
  assert.equal(edited.valueEur, 10);
  assert.equal(edited.priority, "bassa");
  assert.equal((await contact(csv.id)).stage, "call");
  assert.equal(await O.updateOpportunity(formula.id, { title: "Stale" }, 1), "conflict");
  const dup = await A.createOpportunityAction({ contactId: csv.id, title: "Seconda trattativa", stage: "nuovo", idempotencyKey: "formula-key-2" });
  assert.match(dup.error, /già un'opportunità aperta/);
  console.log("ok action");

  const dump = await dumpDatabase(db());
  assert.ok(dump.schema.some((s) => s.name === "crm_opportunities"));
  assert.ok(dump.tables.crm_opportunities.rows.length >= 3);
  console.log("ok backup dump");
  console.log("crm opportunities: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
