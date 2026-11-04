/*
 * CRM self-test, no network and no real secrets (temp SQLite, fake ingest secret generated here):
 *   node scripts/crm-test.mjs
 * Checks the crm permission, dedupe normalizers and DB dedupe, site lead idempotency, server-side refusal of actions,
 * and /api/crm/ingest auth (503 unconfigured, 401 wrong bearer, 400 bad payload, 200 + dedupe).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-crm-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD_HASH; delete process.env.CRM_INGEST_SECRET;
globalThis.__jar = new Map();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.9","user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "@/lib/mail") return { url: "data:text/javascript," + encodeURIComponent("export function mailProvider(){return null}"), shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
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
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const M = await import("../lib/migrate.ts");
  await M.ensureCrmSchema();
  await M.ensureCrmSchema();
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
  console.log("ok ingest");
  console.log("crm: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
