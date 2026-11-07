/*
 * CRM contact email self-test, no network, no real mailbox and no real secrets (temp SQLite, throwaway SESSION_SECRET):
 *   node scripts/contact-email-test.mjs
 * Exact address matching (never name, subject or domain), the contact lookup kept out of the inbox list cache (max 12),
 * the shared message resolver (verified uid key, sanitized Message-ID fallback, malformed ids), the Rubrica return URL
 * (only same-origin Rubrica paths, filters/page/contact preserved) and the reused send/draft actions
 * (Email permission, send limits, reply threading from All Mail). Mail goes to in-memory fakes: nothing is ever sent.
 */
import { spawnSync } from "node:child_process";
if (!process.execArgv.includes("--experimental-transform-types")) {
  // lib/mail/imap.ts uses constructor parameter properties, which plain type stripping cannot load.
  const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", ...process.execArgv, new URL(import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-contact-mail-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
for (const k of ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "RESEND_API_KEY", "MAIL_FROM", "AGENCY_IMAP_USER", "AGENCY_IMAP_PASSWORD", "AGENCY_MAIL_MOCK", "VERCEL_ENV"]) delete process.env[k];
process.env.AGENCY_MAIL_MOCK_DELAY_MS = "0";
globalThis.__jar = new Map();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.7","user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:()=>{},delete:()=>{}}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "@/lib/mail" && !ctx.parentURL?.includes("/scripts/")) return { url: "data:text/javascript," + encodeURIComponent("export function mailProvider(){return globalThis.__mail ?? null};export const isAgencyAddress=(a)=>!!a&&a.toLowerCase()==='agenzia@example.test';export const agencyAddress=()=>'agenzia@example.test'"), shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});
const key = (messageId) => createHash("sha256").update(messageId).digest("hex").slice(0, 32);

try {
  // 1. One exact, normalized address. Anything else (lists, brackets, names, control characters) links nothing.
  const X = await import("../lib/mail/contact.ts");
  assert.equal(X.contactAddress("  Info@FratelliSavigliano.example "), "info@fratellisavigliano.example");
  for (const bad of [null, undefined, 42, "", "info", "a@b", "a@b.c, d@e.f", "a@b.c; d@e.f", "<a@b.c>", '"A" <a@b.c>', "a b@c.d", "a@b.c\nBcc: x@y.z", "a\u0000@b.c", `${"x".repeat(251)}@b.c`, "from:a@b.c OR x"]) {
    assert.equal(X.contactAddress(bad), null, `rejected: ${JSON.stringify(bad)}`);
  }
  const A = X.contactAddress("info@fratellisavigliano.example");
  const p = (address, name = "") => ({ name, address });
  assert.ok(X.involvesAddress({ from: p("INFO@FratelliSavigliano.example") }, A), "case-insensitive From");
  assert.ok(X.involvesAddress({ from: p("x@y.z"), cc: [p(" info@fratellisavigliano.example ")] }, A), "Cc counts");
  assert.ok(X.involvesAddress({ from: p("x@y.z"), replyTo: [p("info@fratellisavigliano.example")] }, A), "Reply-To counts");
  assert.ok(X.involvesAddress({ from: [p("x@y.z"), p("info@fratellisavigliano.example")] }, A), "any From of an envelope");
  for (const [why, m] of [
    ["same domain, other mailbox", { from: p("vendite@fratellisavigliano.example", "Fratelli Savigliano") }],
    ["longer domain", { from: p("info@fratellisavigliano.example.org") }],
    ["prefix", { to: [p("xinfo@fratellisavigliano.example")] }],
    ["display name only", { from: p("other@example.test", "info@fratellisavigliano.example") }],
    ["no parties", {}],
    ["broken party", { from: null, to: [null, { address: null }, {}] }],
  ]) assert.equal(X.involvesAddress(m, A), false, why);
  const isUs = (a) => a === "agenzia@example.test";
  assert.equal(X.mailDirection(p("agenzia@example.test"), isUs), "sent");
  assert.equal(X.mailDirection(p("info@fratellisavigliano.example"), isUs), "received");
  assert.equal(X.mailDirection(null, isUs), "received");
  console.log("ok exact address matching");

  // 2. The mock mailbox: the contact's 4 messages (one only in Cc), no decoy, nothing from Spam.
  const { MockProvider } = await import("../lib/mail/mock.ts");
  const mock = new MockProvider();
  const got = await mock.contactMessages(A);
  assert.deepEqual(got.list.map((m) => m.subject), ["Re: Informazioni", "Informazioni", "Re: Presentazione CTRL®", "Presentazione CTRL®"]);
  assert.ok(got.list.every((m) => m.folder === "all"), "All Mail uids");
  assert.equal(got.more, false);
  assert.deepEqual((await mock.contactMessages(X.contactAddress("nessuno@example.test"))).list, [], "empty for an unknown address");
  const opened = await mock.message("all", got.list[2].uid);
  assert.equal(opened.open?.key, got.list[2].key);
  assert.ok(opened.thread.length === 2, "conversation of the opened message");
  assert.equal((await mock.message("all", 999_999)).open, null, "missing uid is null, not an error");
  assert.equal((await mock.findByMessageId("sav-2@fratellisavigliano.example"))?.key, key("<sav-2@fratellisavigliano.example>"));
  assert.equal(await mock.findByMessageId("nope@example.test"), null);
  console.log("ok mock contact mailbox");

  // 3. IMAP provider: the contact lookup never enters (or evicts) the inbox list cache, uses standard SEARCH
  //    criteria (no X-GM-RAW from the address) and filters the envelopes exactly.
  const { ImapProvider } = await import("../lib/mail/imap.ts");
  const { default: MailComposer } = await import("nodemailer/lib/mail-composer/index.js");
  const env = (uid, from, extra = {}) => ({ uid, seq: uid, flags: new Set(["\\Seen"]), labels: new Set(), threadId: `t${uid}`, internalDate: new Date(Date.UTC(2026, 10, 1, 9, uid)),
    envelope: { messageId: `<m${uid}@example.test>`, subject: `S${uid}`, date: new Date(Date.UTC(2026, 10, 1, 9, uid)), from: [{ name: "", address: from }], to: [{ name: "", address: "agenzia@example.test" }], ...extra } });
  const ALL = {
    1: env(1, "INFO@FratelliSavigliano.example"),
    2: env(2, "vendite@fratellisavigliano.example"),
    3: env(3, "matteo@fratellisavigliano.example", { cc: [{ name: "", address: "info@fratellisavigliano.example" }] }),
    4: env(4, "info@fratellisavigliano.example.org"),
    5: env(5, "x@example.test", { replyTo: [{ name: "", address: "info@fratellisavigliano.example" }] }),
  };
  const source = await new MailComposer({ from: "info@fratellisavigliano.example", to: "agenzia@example.test", subject: "S1", messageId: "<m1@example.test>", text: "ciao" }).compile().build();
  const log = { searches: [], listFetches: 0, opened: [] };
  let box = "";
  const client = {
    usable: true, mailbox: { exists: 0 },
    list: async () => [
      { path: "INBOX", flags: new Set() }, { path: "[Gmail]/All", specialUse: "\\All", flags: new Set() },
      { path: "[Gmail]/Trash", specialUse: "\\Trash", flags: new Set() }, { path: "[Gmail]/Spam", specialUse: "\\Junk", flags: new Set() },
    ],
    status: async () => ({ messages: 200, unseen: 2 }),
    getMailboxLock: async (path) => { box = path; client.mailbox = { exists: path === "INBOX" ? 1000 : 5 }; return { release() {} }; },
    search: async (q) => {
      log.searches.push({ box, q });
      if (q.gmraw) return box === "[Gmail]/Trash" && q.gmraw === "rfc822msgid:m9@example.test" ? [9] : [];
      if (q.threadId) return [];
      return [1, 2, 3, 4, 5];
    },
    fetchAll: async (range) => {
      if (box === "INBOX") { log.listFetches += 1; return []; }
      return String(range).split(",").map(Number).map((u) => ALL[u]).filter(Boolean);
    },
    fetchOne: async (uid, query) => {
      log.opened.push(`${box}:${uid}`);
      if (box === "[Gmail]/Trash" && uid === "9") return env(9, "info@fratellisavigliano.example", { messageId: "<m9@example.test>" });
      if (uid !== "1") return false;
      return query.source ? { uid: 1, source } : { ...ALL[1], size: source.length };
    },
    messageFlagsAdd: async () => true, messageFlagsRemove: async () => true, messageMove: async () => true,
    close() {},
  };
  const imap = new ImapProvider({ user: "test@example.test", pass: "not-a-password", fromName: "CTRL", fromAddress: "agenzia@example.test" });
  imap.withClient = async (run) => run(client);
  for (let page = 1; page <= 12; page++) await imap.view({ folder: "inbox", page });
  assert.equal(log.listFetches, 12, "12 inbox pages cached");
  for (const a of ["info@fratellisavigliano.example", "a@example.test", "b@example.test", "c@example.test", "d@example.test"]) await imap.contactMessages(X.contactAddress(a));
  await imap.message("all", 1);
  await imap.findByMessageId("m9@example.test");
  for (let page = 1; page <= 12; page++) await imap.view({ folder: "inbox", page });
  assert.equal(log.listFetches, 12, "contact lookups, opens and Message-ID searches evicted no inbox page");
  const contactSearch = log.searches.find((s) => s.box === "[Gmail]/All" && s.q.or);
  assert.deepEqual(contactSearch.q, { or: [{ from: "info@fratellisavigliano.example" }, { to: "info@fratellisavigliano.example" }, { cc: "info@fratellisavigliano.example" }] }, "standard criteria");
  assert.ok(!log.searches.some((s) => s.q.gmraw?.includes("fratellisavigliano")), "the address never goes into X-GM-RAW");
  const mine = await imap.contactMessages(A);
  assert.deepEqual(mine.list.map((m) => m.uid), [5, 3, 1], "exact matches only (From, Cc, Reply-To), newest first");
  assert.equal(mine.list[0].folder, "all");
  const before = log.searches.length;
  await imap.contactMessages(A);
  assert.equal(log.searches.length, before, "second lookup inside the fresh window: no network");
  await imap.setSeen("all", 3, false);
  assert.equal((await imap.contactMessages(A)).list.find((m) => m.uid === 3).seen, false, "read state follows setSeen");
  await imap.mutate("all", [3], "read");
  await imap.contactMessages(A);
  assert.ok(log.searches.length > before, "a mailbox change drops the contact cache too");
  const one = await imap.message("all", 1);
  assert.equal(one.open?.key, key("<m1@example.test>"));
  assert.equal((await imap.message("all", 2)).open, null, "gone uid");
  const where = await imap.findByMessageId("m9@example.test");
  assert.equal(where?.folder, "trash");
  console.log("ok imap contact lookup isolated from the inbox cache");

  // 4. Shared resolver (desk link and contact view): verified key first, then the sanitized Message-ID, else missing.
  const R = await import("../lib/mail/resolve.ts");
  assert.equal(R.safeMessageId("<abc.def@ex-ample.test>"), "abc.def@ex-ample.test");
  for (const bad of ["", null, "a b@c", "x@y OR from:evil", "x@y)(", "x@y\"", "a".repeat(251), "rfc822msgid:x@y in:anywhere"]) assert.equal(R.safeMessageId(bad), null, `unsafe id ${JSON.stringify(bad)}`);
  const calls = [];
  const fake = (byUid, byId) => ({
    message: async (folder, uid) => { calls.push(["message", folder, uid]); return { open: byUid[uid] ?? null, thread: [] }; },
    findByMessageId: async (id) => { calls.push(["find", id]); return byId[id] ?? null; },
  });
  const K1 = "a".repeat(32), K2 = "b".repeat(32);
  let loads = 0;
  const lazy = async () => { loads += 1; return "<moved@example.test>"; };
  let r = await R.locateMessage(fake({ 7: { key: K1 } }, {}), { folder: "all", uid: 7, key: K1, messageId: lazy });
  assert.equal(r.kind, "same"); assert.equal(loads, 0, "Message-ID not read when the uid still holds the key");
  r = await R.locateMessage(fake({ 7: { key: K2 } }, { "moved@example.test": { folder: "all", uid: 70, key: K1 } }), { folder: "all", uid: 7, key: K1, messageId: lazy });
  assert.deepEqual([r.kind, r.folder, r.uid], ["moved", "all", 70], "uid reused by another message: found again by Message-ID");
  r = await R.locateMessage(fake({}, { "moved@example.test": { folder: "spam", uid: 3, key: K2 } }), { folder: "all", uid: 7, key: K1, messageId: lazy });
  assert.equal(r.kind, "missing", "a Message-ID hit with another key is not the message");
  calls.length = 0;
  r = await R.locateMessage(fake({}, {}), { folder: "all", uid: 7, key: K1, messageId: "x@y OR in:anywhere" });
  assert.equal(r.kind, "missing"); assert.ok(!calls.some((c) => c[0] === "find"), "unsafe Message-ID never searched");
  calls.length = 0;
  r = await R.locateMessage(fake({}, {}), { folder: "all", uid: -1, key: K1, messageId: null });
  assert.equal(r.kind, "missing"); assert.equal(calls.length, 0, "invalid uid: no provider call");
  console.log("ok shared resolver");

  // 5. URL state: the Rubrica "back" is rebuilt, never echoed; malformed parameters fall back to defaults.
  const N = await import("../lib/crm-nav.ts");
  const ID = "00000000-0000-4000-8000-000000000200";
  const q = N.parseContactMailQuery({ da: "q=Savigliano&fase=contattato&ordina=nome&dir=asc&p=2&c=00000000-0000-4000-8000-000000000999&tab=note", vista: "inviate", m: "10113", k: "f".repeat(32), compose: "reply", img: "1" });
  assert.equal(N.rubricaReturn(ID, q.back), `/admin/crm/rubrica?q=Savigliano&fase=contattato&ordina=nome&dir=asc&p=2&c=${ID}`, "filters, sort, page kept; this contact open");
  assert.equal(N.rubricaReturn(ID, q.back, "note"), `/admin/crm/rubrica?q=Savigliano&fase=contattato&ordina=nome&dir=asc&p=2&c=${ID}&tab=note`);
  assert.deepEqual(N.parseContactMailQuery(new URLSearchParams(N.contactMailSearch(q).slice(1))), q, "round trip");
  assert.equal(N.contactMailSearch(q, { m: null }), "?da=q%3DSavigliano%26fase%3Dcontattato%26ordina%3Dnome%26dir%3Dasc%26p%3D2&vista=inviate&compose=reply", "no k/img without a message");
  for (const da of ["//evil.example/x", "https://evil.example", "javascript:alert(1)", "/admin/team", "%0d%0aSet-Cookie:x=1", "?c=../../x", "x".repeat(5000)]) {
    const back = N.rubricaReturn(ID, N.parseContactMailQuery({ da }).back);
    assert.ok(back.startsWith("/admin/crm/rubrica?") && !/evil|javascript|team|Set-Cookie|\.\./i.test(back.replace(/q=[^&]*/, "")), `safe back for ${da.slice(0, 30)}: ${back}`);
  }
  assert.equal(N.rubricaReturn("../../admin", N.parseContactMailQuery({}).back), "/admin/crm/rubrica", "bad id never enters the path");
  for (const m of ["0", "-1", "1e3", "abc", "12345678901", "1.5", ""]) assert.equal(N.parseContactMailQuery({ m }).m, null, `m=${m}`);
  for (const k of ["", "x", "F".repeat(32), "a".repeat(31), "a".repeat(33)]) assert.equal(N.parseContactMailQuery({ k }).k, "", `k=${k}`);
  assert.equal(N.parseContactMailQuery({ compose: "forward" }).compose, null);
  assert.equal(N.parseContactMailQuery({ vista: "spam" }).vista, "tutte");
  assert.equal(N.parseContactMailQuery({ da: ["a", "b"] }).back.q, "", "array da ignored");
  assert.equal(N.crmCrumb(`/admin/crm/${ID}/email`), "Email");
  assert.equal(N.crmCrumb(`/admin/crm/${ID}`), "Scheda contatto");
  assert.equal(N.crmCrumb("/admin/crm/rubrica"), "Rubrica");
  console.log("ok contact email URL state and safe return");

  // 6. Composer actions reused as-is: Email permission, send limits, reply threading from All Mail, manual draft save.
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  await db().execute("DROP TABLE email_send_log");
  const M = await import("../lib/migrate.ts");
  await Promise.all([M.ensureTeamSchema(), M.ensureEmailSchema(), M.ensureCrmSchema(), M.ensureDeskSchema()]);
  const addUser = async (id, roles, emailAccess) => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, ?)", args: [id, `${id}@t.test`, `Utente ${id}`, emailAccess ? 1 : 0] });
    for (const r of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, r] });
  };
  const { SignJWT } = await import("jose");
  const signIn = async (id) => globalThis.__jar.set("ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET)));
  await addUser("u-crm", ["commerciale"], false);
  await addUser("u-both", ["commerciale"], true);
  const sent = [], drafts = [], ctxCalls = [];
  globalThis.__mail = {
    send: async (m) => { sent.push(m); return { messageId: `<s${sent.length}@test.invalid>` }; },
    replyContext: async (folder, uid) => { ctxCalls.push([folder, uid]); return { messageId: "<sav-2@fratellisavigliano.example>", references: ["<sav-1@ctrl.example>"], subject: "Re: Presentazione CTRL®", replyTo: [], from: null, to: [], cc: [] }; },
    saveDraft: async (m) => { drafts.push(m); return 501; },
    mutate: async () => {},
  };
  const E = await import("../app/admin/email-actions.ts");
  const form = (fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
  const reply = { to: "info@fratellisavigliano.example", subject: "Re: Presentazione CTRL®", body: "Grazie, sentiamoci martedì.", replyFolder: "all", replyUid: "10114" };
  globalThis.__jar.clear();
  assert.match((await E.sendMail({}, form(reply))).error ?? "", /non autorizzata/, "no session");
  await signIn("u-crm");
  assert.match((await E.sendMail({}, form(reply))).error ?? "", /non autorizzata/, "CRM without Email cannot send from the contact view");
  assert.match((await E.saveMailDraft({}, form(reply))).error ?? "", /non autorizzata/, "nor save a draft");
  assert.equal(sent.length + drafts.length, 0);
  await signIn("u-both");
  const ok = await E.sendMail({}, form(reply));
  assert.ok(ok.ok, ok.error);
  assert.deepEqual(ctxCalls, [["all", 10114]], "reply context read from All Mail");
  assert.equal(sent[0].inReplyTo, "<sav-2@fratellisavigliano.example>");
  assert.deepEqual(sent[0].references, ["<sav-1@ctrl.example>", "<sav-2@fratellisavigliano.example>"]);
  assert.deepEqual(sent[0].to, ["info@fratellisavigliano.example"]);
  assert.equal(Number((await db().execute("SELECT COUNT(*) AS n FROM email_send_log WHERE user_id = 'u-both'")).rows[0].n), 1, "counted toward the limits");
  const big = form(reply); big.append("attachments", new File([new Uint8Array(3 * 1024 * 1024 + 1)], "grande.pdf", { type: "application/pdf" }));
  assert.match((await E.sendMail({}, big)).error ?? "", /3 MB/, "real attachment limit: 3 MB in total");
  for (let i = 0; i < 9; i++) await db().execute({ sql: "INSERT INTO email_send_log (id, user_id, recipients, subject, ok) VALUES (?, 'u-both', 'x@t.test', 's', 1)", args: [`l${i}`] });
  assert.match((await E.sendMail({}, form(reply))).error ?? "", /10 minuti/, "send limits apply");
  assert.equal(sent.length, 1);
  const saved = await E.saveMailDraft({}, form({ ...reply, draftUid: "0" }));
  assert.equal(saved.draftUid, 501); assert.equal(drafts.length, 1, "draft saved only on explicit request");
  console.log("ok composer actions reused (permission, limits, threading, 3 MB, manual draft)");

  // 7. The shared reply prefill: our own message opened from All Mail replies to its recipients, not to us.
  const RP = await import("../lib/mail/reply.ts");
  const ours = { folder: "all", uid: 1, key: K1, from: p("agenzia@example.test", "CTRL"), to: [p("info@fratellisavigliano.example", "Fratelli Savigliano")], cc: [p("agenzia@example.test")], replyTo: [], subject: "Presentazione", date: "2026-10-18T09:00:00.000Z", text: "Testo", seen: true, hasAttachments: false, threadId: null, messageId: null, references: [], html: null, attachments: [] };
  assert.equal(RP.replyDraft(ours, false).to, "Fratelli Savigliano <info@fratellisavigliano.example>");
  assert.equal(RP.replyDraft(ours, true).cc, "", "never Cc ourselves");
  const theirs = { ...ours, folder: "inbox", from: p("info@fratellisavigliano.example"), to: [p("agenzia@example.test")], cc: [p("matteo@fratellisavigliano.example")] };
  assert.equal(RP.replyDraft(theirs, false).to, "info@fratellisavigliano.example");
  assert.equal(RP.replyDraft(theirs, true).cc, "matteo@fratellisavigliano.example");
  assert.equal(RP.replyDraft(theirs, false).subject, "Re: Presentazione");
  console.log("ok reply prefill");

  console.log("contact email tests passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
