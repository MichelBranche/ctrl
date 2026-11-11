/*
 * Contact wizard: validation, Discord payload, submit, and CRM dedup.
 * Temp SQLite and a local webhook only. Nothing leaves the machine.
 *   node scripts/contact-inquiry-test.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-inquiry-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
process.env.DISCORD_BURST_MS = "0";
delete process.env.DISCORD_WEBHOOK_URL;
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.9","user-agent":"test"})}
export async function cookies(){return{get:()=>undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript," + encodeURIComponent("export function after(f){const p=Promise.resolve().then(()=>typeof f==='function'?f():f);(globalThis.__after??=[]).push(p);return p}"), shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const Q = await import("../lib/contact-inquiry.ts");

const base = {
  services: ["website", "shop"],
  goal: "scratch",
  budget: "to_6000",
  timing: "quarter",
  name: "Mario Rossi",
  email: "Mario.Rossi@example.com",
  phone: "333 1234567",
  note: "Vorrei partire a gennaio",
  lang: "it",
};

const ok = Q.parseInquiry(base);
assert.equal(ok.ok, true);
assert.equal(ok.inquiry.email, "mario.rossi@example.com");
assert.equal(ok.inquiry.phone, "+393331234567");
assert.deepEqual(ok.inquiry.services, ["website", "shop"]);
const brief = Q.adminBrief(ok.inquiry);
assert.match(brief.subject, /Sito web/);
assert.match(brief.message, /Obiettivo: Partire da zero/);
assert.match(brief.message, /3\.000-6\.000 €, IVA esclusa/);
assert.match(brief.message, /Telefono: \+393331234567/);
assert.match(brief.message, /Vorrei partire a gennaio/);
assert.equal(brief.message.includes("\u2014"), false);

assert.deepEqual(Q.parseInquiry({ ...base, services: [] }).issues, ["services"]);
assert.ok(Q.parseInquiry({ ...base, services: ["website", "nope"] }).issues.includes("services"));
assert.ok(Q.parseInquiry({ ...base, goal: "" }).issues.includes("goal"));
assert.ok(Q.parseInquiry({ ...base, email: "nope" }).issues.includes("email"));
assert.ok(Q.parseInquiry({ ...base, name: "  " }).issues.includes("name"));
assert.ok(Q.parseInquiry({ ...base, phone: "12" }).issues.includes("phone"));
assert.equal(Q.parseInquiry({ ...base, phone: "" }).inquiry.phone, null);
assert.equal(Q.parseInquiry({ ...base, phone: "+39" }).inquiry.phone, null);
assert.equal(Q.parseInquiry({ ...base, phone: "+44 7700 900123" }).inquiry.phone, "+447700900123");
assert.equal(Q.stepIssue(0, { ...base, services: [], goal: null, budget: null, timing: null, step: 0 }), "services");
assert.equal(Q.stepIssue(4, { ...base, services: ["website"], goal: "leads", budget: "unsure", timing: "asap", step: 4, email: "a@b.c" }), "email");

const poisoned = Q.parseInquiry({ ...base, name: "Mario @everyone", note: "ciao <@123> *x*" });
const payload = Q.siteInquiryDiscordPayload(poisoned.inquiry, "https://www.ctrlagency.dev/admin/requests", "2026-11-09T09:42:00.000Z");
const raw = JSON.stringify(payload);
assert.equal(raw.includes("@everyone"), false);
assert.equal(raw.includes("<@123>"), false);
assert.match(raw, /mario\.rossi@example\.com/);
assert.match(raw, /\+393331234567/);
assert.match(raw, /Sito web/);
assert.match(raw, /Partire da zero/);
assert.match(payload.embeds[0].description, /Mario/);
assert.equal(payload.embeds[0].color, 0x3498db);
assert.deepEqual(payload.allowed_mentions, { parse: [] });
assert.equal(Q.thanksLine("it", "Mario Rossi"), "Grazie, Mario.");
assert.equal(Q.thanksLine("en", "Mario Rossi"), "Thank you, Mario.");
const stored = Q.readDraft(JSON.stringify({ v: 1, ...base, step: 3, services: ["website", "nope"] }));
assert.deepEqual(stored.services, ["website"]);
assert.equal(stored.step, 3);
assert.equal(Q.readDraft(JSON.stringify({ v: 2 })), null);
console.log("ok inquiry validation");

const bodies = [];
let status = 204;
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    bodies.push(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
    res.writeHead(status);
    res.end();
  });
});

const drain = async () => {
  const pending = globalThis.__after ?? [];
  globalThis.__after = [];
  await Promise.all(pending);
};

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else if (value != null) data.set(key, String(value));
  }
  return data;
};

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  process.env.DISCORD_WEBHOOK_URL = `http://127.0.0.1:${port}/api/webhooks/123456789012345678/test-token`;
  const { db } = await import("../lib/db.ts");
  for (const file of readdirSync("db").filter((name) => name.endsWith(".sql")).sort()) {
    await db().executeMultiple(readFileSync(join("db", file), "utf8"));
  }
  const { submitContact } = await import("../app/actions/public.ts");
  const crm = await import("../lib/crm.ts");

  assert.deepEqual(await submitContact(form({ ...base, company_site: "https://spam.example" })), { ok: true });
  assert.equal((await db().execute("SELECT COUNT(*) AS n FROM contact_requests")).rows[0].n, 0, "honeypot stores nothing");
  assert.deepEqual(await submitContact(form({ ...base, email: "nope" })), { ok: false, error: "invalid" });
  assert.deepEqual(await submitContact(form({ ...base, services: [] })), { ok: false, error: "invalid" });

  const first = await submitContact(form({ ...base, name: "Mario @everyone", services: ["website", "shop"] }));
  await drain();
  assert.deepEqual(first, { ok: true });
  assert.equal(bodies.length, 1, "one Discord post");
  assert.equal(JSON.stringify(bodies[0]).includes("@everyone"), false);
  assert.match(JSON.stringify(bodies[0]), /mario\.rossi@example\.com/);
  assert.match(JSON.stringify(bodies[0]), /Sito web, E-commerce/);
  const row = (await db().execute("SELECT name, email, subject, message, lang FROM contact_requests")).rows[0];
  assert.equal(row.email, "mario.rossi@example.com");
  assert.match(String(row.subject), /Sito web/);
  assert.match(String(row.message), /IVA esclusa/);
  const leads = await crm.listContacts({ source: "sito" });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].phone, "+393331234567");
  assert.equal(leads[0].contactName, "Mario @everyone");

  const byPhone = await submitContact(form({ ...base, name: "Lucia", email: "lucia@altra-mail.it", phone: "3331234567", services: ["hotel"], goal: "bookings" }));
  await drain();
  assert.deepEqual(byPhone, { ok: true });
  assert.equal((await crm.listContacts({ source: "sito" })).length, 1, "same phone does not duplicate");
  assert.equal((await crm.listNotes(leads[0].id)).length, 1);
  const note = (await crm.listNotes(leads[0].id))[0].body;
  assert.match(note, /Rif\. sito /);
  assert.match(note, /hotel|Hotel|prenotazione/i);

  const again = await submitContact(form({ ...base, name: "Mario Rossi", email: "MARIO.rossi@example.com", services: ["brand"], goal: "rebuild" }));
  await drain();
  assert.deepEqual(again, { ok: true });
  assert.equal((await crm.listContacts({ source: "sito" })).length, 1, "same email does not duplicate");
  assert.equal((await crm.listNotes(leads[0].id)).length, 2);

  const fresh = await submitContact(form({ ...base, name: "Giulia Verdi", email: "giulia.verdi.nuova@gmail.com", phone: "", services: ["app"], note: "" }));
  await drain();
  assert.deepEqual(fresh, { ok: true });
  const giulia = (await crm.listContacts({ q: "Giulia" }))[0];
  assert.ok(giulia);
  assert.equal(giulia.phone, null);
  assert.match(giulia.notes ?? "", /Web app/);

  status = 500;
  const before = bodies.length;
  const still = await submitContact(form({ ...base, name: "Nico Blu", email: "nico.blu.nuovo@gmail.com", phone: "3201234567", services: ["brand"] }));
  await drain();
  assert.deepEqual(still, { ok: true }, "Discord failure still saves the request");
  assert.ok(bodies.length > before);
  assert.ok((await crm.listContacts({ q: "Nico" })).length === 1);

  status = 204;
  const limited = await submitContact(form({ ...base, name: "Di troppo", email: "troppi@gmail.com", phone: "", services: ["other"] }));
  assert.deepEqual(limited, { ok: false, error: "rate" });
  assert.equal((await db().execute("SELECT COUNT(*) AS n FROM contact_requests WHERE email = 'troppi@gmail.com'")).rows[0].n, 0);
  await new Promise((resolve) => setTimeout(resolve, 40));
  await drain();

  console.log("ok contact submit + dedup");
} finally {
  server.closeAllConnections?.();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
