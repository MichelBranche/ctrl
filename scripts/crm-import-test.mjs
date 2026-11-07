/*
 * CSV import, no network and no real contacts:
 *   node scripts/crm-import-test.mjs
 * Parser (BOM, separators, quotes, multiline, formula cells), preview that does not write, confirm through
 * createContact, duplicates in the file and in the database (including an Iris row, which is not overwritten),
 * a second import of the same file, a concurrent confirm, and the crm permission.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-import-"));
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

const C = await import("../lib/crm-import-core.ts");

const semi = C.parseCsv("\uFEFFAzienda;E-mail;Telefono;Punteggio\r\n\"Cantina \"\"QA\"\"\";info@cantina-qa.test;+39 0173 000111;95\r\n");
assert.ok(!("error" in semi));
assert.deepEqual(semi.headers, ["Azienda", "E-mail", "Telefono", "Punteggio"]);
assert.equal(semi.rows[0][0], "Cantina \"QA\"");
assert.deepEqual(C.guessMap(semi.headers), ["businessName", "email", "phone", ""]);
assert.equal(C.guessField("Fase"), "");
assert.equal(C.guessField("Responsabile"), "");

const quoted = C.parseCsv("nome,note\n\"Bar\nCentrale\",\"prima riga\nseconda\"\n");
assert.ok(!("error" in quoted));
assert.equal(quoted.rows[0][0], "Bar\nCentrale");
assert.equal(quoted.rows[0][1], "prima riga\nseconda");
assert.equal(C.detectSeparator("a\tb\tc\n1\t2\t3\n"), "\t");
assert.match(C.parseCsv("solo intestazione\n").error, /intestazione/);
assert.match(C.parseCsv("\"aperto\n").error, /Virgolette/);
assert.match(C.parseCsv("a\n" + Array.from({ length: 201 }, (_, i) => `n${i}`).join("\n")).error, /200/);
const formula = C.normalizeRow({ businessName: "=cmd|' /C calc'!A0", email: "formula.import@example.test" });
assert.equal(formula.issue, null);
assert.equal(formula.text.businessName, "'=cmd|' /C calc'!A0");
assert.equal(C.normalizeRow({ businessName: "X", email: "nope" }).issue, "email");
assert.equal(C.normalizeRow({ businessName: "X" }).issue, "chiave");
assert.equal(C.normalizeRow({ businessName: "X", phone: "=1+1" }).issue, "telefono");
assert.equal(C.normalizeRow({ businessName: "X", phone: "+39 333 1234567" }).issue, null);
assert.equal(C.normalizeRow({ businessName: "<script>alert(1)</script>", email: "script.import@example.test" }).text.businessName, "<script>alert(1)</script>");
assert.equal(C.mapRows([["A", "9"]], ["businessName", "email"]).length, 1);
assert.match(C.mapRows([["A"]], [""]).error, /Azienda/);
assert.match(C.mapRows([["A", "B"]], ["businessName", "businessName"]).error, /stesso campo/);
console.log("ok csv parse");

try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((name) => name.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const M = await import("../lib/migrate.ts");
  await M.ensureTeamSchema();
  await M.ensureCrmSchema();
  const K = await import("../lib/crm.ts");
  const I = await import("../lib/crm-import.ts");
  const A = await import("../app/admin/crm-import-actions.ts");
  const { SignJWT } = await import("jose");
  const addUser = async (id, roles) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, 0)", args: [id, `${id}@t.test`, id] });
    for (const role of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, role] });
  };
  const signIn = async (id) => globalThis.__jar.set("ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET)));
  await addUser("u-sales", ["commerciale"]);
  await addUser("u-pm", ["project_manager"]);

  const iris = await K.createContact({ businessName: "Hotel Belvedere", email: "hotelbelvedere@example.test", source: "radar", score: 91, scoreReasons: ["Sito lento"], stage: "nuovo", ownerUserId: "u-sales" }, null);
  await K.createContact({ businessName: "Dominio esistente", email: "info@dominio-esistente.test", website: "https://dominio-esistente.test", source: "manuale" }, null);
  const before = await db().execute("SELECT COUNT(*) AS n FROM crm_contacts");
  const rows = [
    { businessName: "Cantina Import QA", email: "cantina.import@cantina-qa.test", phone: "+39 0173 000111", city: "Alba", score: 99, ownerUserId: "hacker", stage: "vinto" },
    { businessName: "Hotel Belvedere", email: "HOTELBELVEDERE@example.test", notes: "non deve finire sul prospect" },
    { businessName: "Email rotta", email: "non-una-email" },
    { businessName: "Cantina Import QA", email: "cantina.import@cantina-qa.test" },
    { businessName: "Senza riferimento" },
    { businessName: "Altra Gmail", email: "altra.import@gmail.com" },
    { businessName: "Stessa azienda", email: "vendite@cantina-import.test", website: "https://www.cantina-import.test" },
    { businessName: "Stessa azienda 2", email: "info@cantina-import.test" },
    { businessName: "Altro ufficio", email: "altro@dominio-esistente.test" },
  ];
  const preview = await I.previewImport(rows);
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_contacts")).rows[0].n), Number(before.rows[0].n), "preview writes nothing");
  assert.deepEqual(preview.counts, { fresh: 3, file: 2, db: 2, invalid: 2 });
  assert.equal(preview.rows[1].status, "db");
  assert.match(preview.rows[1].reason, /Hotel Belvedere/);
  assert.match(preview.rows[1].reason, /Radar/);
  assert.equal(preview.rows[3].status, "file");
  assert.equal(preview.rows[6].status, "new");
  assert.equal(preview.rows[7].status, "file", "same company domain as an earlier row in the file");
  assert.equal(preview.rows[8].status, "db", "email domain matches a website already stored");
  console.log("ok preview");

  await signIn("u-pm");
  await assert.rejects(() => A.previewCsvImportAction(rows), /unauthorized/);
  await assert.rejects(() => A.confirmCsvImportAction(rows), /unauthorized/);
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM crm_contacts")).rows[0].n), Number(before.rows[0].n), "refused import writes nothing");
  console.log("ok permission");

  await signIn("u-sales");
  const done = await A.confirmCsvImportAction(rows);
  assert.deepEqual(done, { inserted: 3, skipped: 4, invalid: 2 });
  const created = await K.getContact((await K.listContacts({ q: "Cantina Import QA" }))[0].id);
  assert.equal(created.source, "manuale");
  assert.equal(created.score, null);
  assert.equal(created.ownerUserId, null);
  assert.equal(created.stage, "nuovo");
  assert.deepEqual(created.scoreReasons, []);
  const kept = await K.getContact(iris.id);
  assert.equal(kept.score, 91);
  assert.deepEqual(kept.scoreReasons, ["Sito lento"]);
  assert.equal(kept.ownerUserId, "u-sales");
  assert.equal(kept.stage, "nuovo");
  assert.equal(kept.source, "radar");
  assert.equal(kept.notes, null, "import does not write notes onto an existing contact");
  assert.equal((await K.listDrafts([created.id, iris.id])).length, 0, "import creates no draft");
  const audit = (await db().execute("SELECT details FROM audit_log WHERE action = 'crm.import'")).rows.map((r) => String(r.details));
  assert.equal(audit.length, 1);
  assert.ok(!audit[0].includes("cantina.import") && !audit[0].includes("Hotel"), "audit keeps counts, not the rows");
  console.log("ok confirm");

  const again = await A.confirmCsvImportAction(rows);
  assert.equal(again.inserted, 0);
  assert.equal(await K.countContacts({ q: "Cantina Import QA" }), 1, "reimport does not duplicate");
  assert.equal((await K.getContact(iris.id)).score, 91);
  console.log("ok replay");

  const raceRow = [{ businessName: "Race Import QA", email: "race.import@race-qa.test" }];
  const [left, right] = await Promise.all([I.confirmImport(raceRow, "u-sales"), I.confirmImport(raceRow, "u-sales")]);
  assert.equal(left.inserted + right.inserted, 1);
  assert.equal(left.skipped + right.skipped, 1);
  assert.equal(await K.countContacts({ q: "Race Import QA" }), 1);
  const raced = (await K.listContacts({ q: "Race Import QA" }))[0];
  assert.equal(raced.ownerUserId, null);
  assert.equal(raced.score, null);
  console.log("ok race");

  const phone = await I.confirmImport([{ businessName: "Telefono QA", phone: "0039 333 1234567" }], "u-sales");
  assert.equal(phone.inserted, 1);
  const phoneAgain = await I.confirmImport([{ businessName: "Telefono QA copia", phone: "+39 333 1234567" }], "u-sales");
  assert.equal(phoneAgain.inserted, 0);
  assert.equal(phoneAgain.skipped, 1);
  console.log("ok phone dedupe");

  console.log("crm import: all checks passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
