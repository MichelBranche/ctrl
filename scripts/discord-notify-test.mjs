/*
 * Discord webhook self-test. Local mock only, temp SQLite, no real webhook:
 *   node scripts/discord-notify-test.mjs
 * Payload shape, no sensitive fields, 429 with one retry, timeout, missing env sends nothing.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-discord-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.DISCORD_WEBHOOK_URL;
process.env.DISCORD_BURST_MS = "0";
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.9","user-agent":"test"})}
export async function cookies(){return{get:()=>undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript," + encodeURIComponent("export function after(f){return typeof f==='function'?f():f}"), shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const BANNED = ["segreto@cantina.it", "michel@ctrlagency.dev", "secret@x.it", "corpo segreto", "nota privata", "+39 333", "3331112233", "NonOggi", "Domani Spa", "@everyone", "@here"];

function assertClean(payload) {
  const raw = JSON.stringify(payload);
  for (const secret of BANNED) assert.equal(raw.includes(secret), false, secret);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.ok(Array.isArray(payload.embeds) && payload.embeds.length <= 10);
  for (const embed of payload.embeds) {
    assert.match(embed.url, /^https:\/\/www\.ctrlagency\.dev\/admin/);
    assert.equal(typeof embed.timestamp, "string");
    assert.equal(Number.isInteger(embed.color), true);
  }
}

const bodies = [];
let mode = "ok";
let modeHits = 0;
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    if (mode === "hang") return;
    const payload = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    bodies.push(payload);
    assertClean(payload);
    if (mode === "429" && modeHits === 0) {
      modeHits += 1;
      res.writeHead(429, { "content-type": "application/json", "retry-after": "0.05" });
      res.end(JSON.stringify({ retry_after: 0.05, message: "You are being rate limited." }));
      return;
    }
    modeHits += 1;
    res.writeHead(204);
    res.end();
  });
});

const hang = createServer(() => {});

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await new Promise((resolve) => hang.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const webhook = `http://127.0.0.1:${port}/api/webhooks/123456789012345678/test-token`;
  const { db } = await import("../lib/db.ts");
  for (const file of readdirSync("db").filter((name) => name.endsWith(".sql")).sort()) {
    await db().executeMultiple(readFileSync(join("db", file), "utf8"));
  }
  const migrate = await import("../lib/migrate.ts");
  await migrate.ensureCrmSchema();
  await migrate.ensureDeskSchema();
  await migrate.ensureDiscordSchema();
  const core = await import("../lib/discord-core.ts");
  const discord = await import("../lib/discord-notify.ts");
  const { logAction } = await import("../lib/audit.ts");
  const { rememberMailReferences } = await import("../lib/desk.ts");

  const title = core.auditTitle("crm.contact_create", { name: "Bar *Alba*", email: "secret@x.it", phone: "+39 333 1112233", message: "corpo segreto" }, null);
  assert.equal(title.includes("secret@"), false);
  assert.equal(title.includes("corpo"), false);
  assert.match(title, /Bar/);
  const poisoned = core.discordPayload([{ kind: "other", event: "Prova", title: "Ciao @everyone <@123> *x*", actor: "A | B", href: "/admin", at: "2026-11-09T09:42:00.000Z" }]);
  assert.equal(JSON.stringify(poisoned).includes("@everyone"), false);
  assert.equal(JSON.stringify(poisoned).includes("<@123>"), false);
  assert.match(poisoned.embeds[0].description, /\\\*/);
  assert.match(poisoned.embeds[0].fields[0].value, /\\\|/);
  assert.equal(core.discordWebhookUrl("https://evil.example/api/webhooks/1/abc"), null);
  assert.equal(core.discordWebhookUrl(""), null);
  assert.ok(core.discordWebhookUrl(webhook));

  await discord.recordAdminNotice({ id: "silent", kind: "other", event: "Silenzio", title: "Niente rete", href: "/admin" });
  const silent = await discord.flushDiscord();
  assert.equal(silent.sent, 0);
  assert.equal(bodies.length, 0);
  process.env.DISCORD_WEBHOOK_URL = "https://evil.example/api/webhooks/1/abc";
  await discord.recordAdminNotice({ id: "evil", kind: "other", event: "Silenzio", title: "Niente rete", href: "/admin" });
  assert.equal((await discord.flushDiscord()).sent, 0);
  assert.equal(bodies.length, 0);
  assert.equal((await db().execute("SELECT COUNT(*) AS n FROM discord_outbox")).rows[0].n, 0, "env assente o non valido non scrive la coda");

  process.env.DISCORD_WEBHOOK_URL = webhook;
  await discord.recordAdminNotice({
    id: "privacy",
    kind: "site_form",
    event: "Richiesta dal sito",
    title: "Cantina *Rossi* @everyone segreto@cantina.it +39 333 1112233",
    actor: "Sito",
    href: "/admin/requests",
  }, { flush: false });
  await discord.recordAdminNotice({
    id: "privacy",
    kind: "site_form",
    event: "Richiesta dal sito",
    title: "doppione",
    href: "/admin/requests",
  }, { flush: false });
  const once = await discord.flushDiscord();
  assert.equal(once.sent, 1);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].embeds.length, 1);
  assert.equal(bodies[0].embeds[0].title, "Richiesta dal sito");
  assert.match(bodies[0].embeds[0].description, /Cantina/);
  assert.match(bodies[0].embeds[0].description, /\\\*/);
  assert.equal(bodies[0].embeds[0].url, "https://www.ctrlagency.dev/admin/requests");
  assert.equal(bodies[0].embeds[0].fields[0].value, "Sito");
  assert.equal((await discord.flushDiscord()).sent, 0);
  assert.equal(bodies.length, 1, "il secondo flush non reinvia");

  for (let i = 1; i <= 12; i += 1) {
    await discord.recordAdminNotice({ id: `gruppo-${i}`, kind: "activity", event: "Attività creata", title: `Gruppo ${i}`, actor: "Michel", href: "/admin/crm/attivita" }, { flush: false });
  }
  const grouped = await discord.flushDiscord();
  assert.equal(grouped.sent, 12);
  assert.equal(bodies.at(-2).embeds.length, 10);
  assert.equal(bodies.at(-1).embeds.length, 2);

  mode = "429";
  modeHits = 0;
  await discord.recordAdminNotice({ id: "rate", kind: "radar", event: "Contatti Radar importati", title: "3 nuovi contatti", actor: "Radar", href: "/admin/crm/radar" }, { flush: false });
  const limited = await discord.flushDiscord();
  assert.equal(limited.sent, 1);
  assert.equal(modeHits, 2, "un solo retry dopo il 429");
  const sent = await db().execute({ sql: "SELECT sent_at FROM discord_outbox WHERE id = ?", args: ["rate"] });
  assert.ok(sent.rows[0].sent_at);

  mode = "ok";
  await discord.recordAdminNotice({ id: "lento", kind: "other", event: "Lento", title: "Timeout pulito", href: "/admin" }, { flush: false });
  const hung = await discord.flushDiscord({
    timeoutMs: 200,
    fetchImpl: (_url, init) => fetch(`http://127.0.0.1:${hang.address().port}/api/webhooks/1/abc`, init),
  });
  assert.equal(hung.sent, 0);
  const slow = await db().execute({ sql: "SELECT sent_at, attempts FROM discord_outbox WHERE id = ?", args: ["lento"] });
  assert.equal(slow.rows[0].sent_at, null);
  assert.equal(Number(slow.rows[0].attempts), 1);
  assert.equal((await discord.flushDiscord()).sent, 1, "il tentativo successivo recupera la riga");

  const day = "2026-11-09T12:00:00.000Z";
  await db().execute({
    sql: `INSERT INTO crm_contacts (id, business_name, email, email_norm, phone, notes, next_action, next_action_at, source, stage)
      VALUES ('rossi', 'Cantina Rossi', 'segreto@cantina.it', 'segreto@cantina.it', '+39 333 1112233', 'nota privata', 'Richiedere il listino', '2026-11-09T08:00:00.000Z', 'sito', 'nuovo')`,
  });
  await db().execute({
    sql: `INSERT INTO crm_contacts (id, business_name, next_action, next_action_at, source, stage)
      VALUES ('ieri', 'NonOggi Srl', 'Non chiamare', '2026-11-08T08:00:00.000Z', 'manuale', 'nuovo')`,
  });
  await db().execute({
    sql: `INSERT INTO crm_activities (id, contact_id, title, kind, due_date) VALUES ('act-oggi', 'rossi', 'Richiamare', 'call', '2026-11-09')`,
  });
  await db().execute({
    sql: `INSERT INTO crm_activities (id, contact_id, title, kind, due_date) VALUES ('act-domani', 'rossi', 'Domani Spa', 'followup', '2026-11-10')`,
  });
  const due = await discord.flushDiscord({ now: new Date(day) });
  assert.equal(due.sent, 2);
  const dueTitles = bodies.at(-1).embeds.map((embed) => `${embed.title} ${embed.description}`).join("\n");
  assert.match(dueTitles, /Follow-up in scadenza/);
  assert.match(dueTitles, /Attività in scadenza/);
  assert.match(dueTitles, /Cantina Rossi/);
  assert.match(dueTitles, /Richiedere il listino/);
  assert.doesNotMatch(dueTitles, /NonOggi|Domani|segreto@|nota privata/);

  const mail = (key, extra) => ({
    key, folder: "inbox", uid: extra.uid, subject: extra.subject, seen: extra.seen,
    from: { name: extra.name ?? "", address: extra.address ?? "" }, to: [], date: day, hasAttachments: false, threadId: null,
  });
  await rememberMailReferences({ folders: [], list: [mail("c".repeat(32), { uid: 1, subject: "Storico", seen: false, address: "segreto@cantina.it" })], total: 1, open: null, thread: [] });
  await discord.whenDiscordSettled();
  const primed = bodies.length;
  await rememberMailReferences({
    folders: [],
    list: [mail("d".repeat(32), { uid: 9, subject: "Re: listino *2026* segreto@cantina.it", seen: false, name: "Mario @everyone", address: "segreto@cantina.it" })],
    total: 1, open: null, thread: [],
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  await discord.whenDiscordSettled();
  assert.ok(bodies.length > primed, "la mail nuova parte, lo storico no");
  const reply = bodies.at(-1).embeds.find((embed) => embed.title === "Risposta di un lead");
  assert.ok(reply, "il mittente noto è una risposta");
  assert.match(reply.description, /Cantina Rossi/);
  assert.match(reply.description, /\\\*/);
  assert.equal(reply.url, "https://www.ctrlagency.dev/admin/crm/rossi");
  assert.equal(JSON.stringify(reply).includes("segreto@"), false);

  const before = bodies.length;
  await logAction("crm.contact_create", { type: "crm_contact", id: "rossi" }, {
    name: "ignorato", email: "secret@x.it", phone: "+39 333 1112233", message: "corpo segreto", notes: "nota privata",
  }, { id: "u1", name: "Michel", email: "michel@ctrlagency.dev" });
  await logAction("auth.login_failed", undefined, { email: "secret@x.it" }, null);
  await new Promise((resolve) => setTimeout(resolve, 40));
  await discord.whenDiscordSettled();
  assert.ok(bodies.length > before);
  const created = bodies.slice(before).flatMap((body) => body.embeds).find((embed) => embed.title === "Contatto CRM creato");
  assert.ok(created);
  assert.match(created.description, /Cantina Rossi/);
  assert.equal(created.fields[0].value, "Michel");
  assert.equal(created.url, "https://www.ctrlagency.dev/admin/crm/rossi");
  const failed = bodies.slice(before).flatMap((body) => body.embeds).find((embed) => embed.title === "Accesso fallito");
  assert.ok(failed);
  assert.equal(JSON.stringify(failed).includes("secret@"), false);
  assert.equal(JSON.stringify(failed).includes("@"), false);

  await db().execute({
    sql: `INSERT INTO crm_iris_requests (id, requested_by, day_rome, params, status, created_at, updated_at)
      VALUES ('8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f', 'u1', '2026-11-09', '{}', 'queued', ?, ?)`,
    args: [day, day],
  });
  const iris = await import("../lib/crm-iris.ts");
  const beforeIris = bodies.length;
  assert.equal((await iris.applyIrisStatus("8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f", { status: "working" })).ok, true);
  assert.equal((await iris.applyIrisStatus("8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f", { status: "error", error_message: "segreto@cantina.it nota privata" })).ok, true);
  await new Promise((resolve) => setTimeout(resolve, 40));
  await discord.whenDiscordSettled();
  const irisEmbeds = bodies.slice(beforeIris).flatMap((body) => body.embeds);
  assert.ok(irisEmbeds.some((embed) => embed.description === "in lavorazione"));
  assert.ok(irisEmbeds.some((embed) => embed.description === "errore"));
  assert.match(irisEmbeds[0].url, /\/admin\/crm\/radar\?iris=8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f$/);

  console.log("ok discord");
} finally {
  server.closeAllConnections?.();
  hang.closeAllConnections?.();
  server.close();
  hang.close();
  rmSync(dir, { recursive: true, force: true });
}
