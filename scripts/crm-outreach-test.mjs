/*
 * CRM outreach guard self-test (lib/crm-outreach.ts), no network, no real mailbox, no real secrets:
 *   node scripts/crm-outreach-test.mjs
 * Temp SQLite fixture + in-memory provider that counts every send. Covers: colleague owner, former member, already
 * contacted without owner, self owner, recent sends, stale/forged consent, failure (no assignment), unknown outcome,
 * auto-assignment without overwriting, two collaborators racing (exactly one provider send), duplicate submit,
 * Email-only users (generic notice, no CRM data, no assignment), exact address matching, Radar drafts, PR14 versions.
 */
import { spawnSync } from "node:child_process";
if (!process.execArgv.includes("--experimental-transform-types")) {
  const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", ...process.execArgv, new URL(import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-outreach-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
for (const k of ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "RESEND_API_KEY", "MAIL_FROM", "AGENCY_IMAP_USER", "AGENCY_IMAP_PASSWORD", "AGENCY_MAIL_MOCK", "VERCEL_ENV"]) delete process.env[k];
// Each simulated request carries its own cookie jar, so concurrent calls really are two different people.
globalThis.__als = new AsyncLocalStorage();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":"203.0.113.7","user-agent":"test"})}
export async function cookies(){const j=globalThis.__als.getStore()??new Map();return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:()=>{},delete:()=>{}}}`;
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

try {
  // 0. Unknown-outcome classification of SMTP errors (no double send through the Gmail fallback).
  const { mayHaveSent } = await import("../lib/mail/imap.ts");
  assert.equal(mayHaveSent({ code: "ETIMEDOUT", command: "DATA" }), true);
  assert.equal(mayHaveSent({ code: "ESOCKET" }), true, "socket dropped, step unknown");
  assert.equal(mayHaveSent({ code: "ETIMEDOUT", command: "CONN" }), false, "never connected");
  assert.equal(mayHaveSent({ code: "EAUTH", command: "AUTH PLAIN" }), false);
  assert.equal(mayHaveSent({ code: "EENVELOPE", command: "RCPT TO", responseCode: 550 }), false);
  assert.equal(mayHaveSent({ code: "EMESSAGE", command: "DATA", responseCode: 552 }), false, "explicit rejection of the body");
  assert.equal(mayHaveSent(null), true);
  console.log("ok smtp outcome classification");

  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  await db().execute("DROP TABLE IF EXISTS email_send_log");
  const M = await import("../lib/migrate.ts");
  await Promise.all([M.ensureTeamSchema(), M.ensureEmailSchema(), M.ensureCrmSchema(), M.ensureAuditSchema?.()]);
  await M.ensureCrmSchema(); // idempotent
  const addUser = async (id, roles, emailAccess, extra = "") => {
    await db().execute({ sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', 'member', 1, ?)", args: [id, `${id}@t.test`, `Utente ${id}`, emailAccess ? 1 : 0] });
    for (const r of roles) await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, r] });
    if (extra) await db().execute({ sql: `UPDATE admin_users SET ${extra} WHERE id = ?`, args: [id] });
  };
  await addUser("u-ana", ["commerciale"], true);
  await addUser("u-bea", ["commerciale"], true);
  await addUser("u-posta", ["designer"], true);
  await addUser("u-nomail", ["commerciale"], false);
  await addUser("u-ex", ["commerciale"], true, "active = 0, removed_at = '2026-10-01T00:00:00.000Z'");
  const contact = async (id, email, { owner = null, stage = "nuovo", archived = 0, name = `Contatto ${id}` } = {}) => db().execute({
    sql: "INSERT INTO crm_contacts (id, business_name, email, email_norm, domain, owner_user_id, stage, archived, source) VALUES (?, ?, ?, ?, 'x.test', ?, ?, ?, 'manuale')",
    args: [id, name, email, email.trim().toLowerCase(), owner, stage, archived],
  });
  const C = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await contact(C(1), "Free@X.test ");
  await contact(C(2), "ana@x.test", { owner: "u-ana" });
  await contact(C(3), "ex@x.test", { owner: "u-ex" });
  await contact(C(4), "contacted@x.test", { stage: "contattato" });
  await contact(C(5), "won@x.test", { stage: "vinto" });
  await contact(C(6), "race@x.test");
  await contact(C(7), "other@x.test", { name: "free" }); // decoy: same domain, name looks like another contact
  await contact(C(8), "arch@x.test", { archived: 1 });
  await contact(C(9), "fail@x.test");
  await contact(C(10), "unsure@x.test");
  await contact(C(11), "stale@x.test", { owner: "u-ana" });
  await contact(C(12), "free2@x.test");
  await contact(C(13), "multi@x.test");
  await contact(C(14), "draft@x.test");
  await contact(C(15), "dup@x.test");
  await contact(C(16), "keep@x.test");
  await contact(C(17), "mid@x.test");
  await db().execute({ sql: "INSERT INTO crm_contacts (id, business_name, email, owner_user_id, stage, source) VALUES (?, 'Importato senza email_norm', '  Legacy@X.test ', 'u-ana', 'nuovo', 'manuale')", args: [C(18)] });

  const sent = [];
  let behaviour = async () => {};
  globalThis.__mail = {
    send: async (m) => { await behaviour(m); sent.push(m); return { messageId: `<s${sent.length}@test.invalid>` }; },
    replyContext: async () => null, saveDraft: async () => 1, mutate: async () => {},
  };
  const { SignJWT } = await import("jose");
  const jar = async (id) => new Map([["ctrl_admin", await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("1h").setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET))]]);
  const jars = Object.fromEntries(await Promise.all(["u-ana", "u-bea", "u-posta", "u-nomail"].map(async (u) => [u, await jar(u)])));
  const as = (user, fn) => globalThis.__als.run(jars[user], fn);
  const E = await import("../app/admin/email-actions.ts");
  const A = await import("../app/admin/crm-actions.ts");
  const O = await import("../lib/crm-outreach.ts");
  const { MailError } = await import("../lib/mail/provider.ts");
  const form = (fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.set(k, v); return f; };
  const mail = (user, to, extra = {}) => as(user, () => E.sendMail({}, form({ to, subject: "Proposta", body: "Buongiorno, vi scriviamo da CTRL.", ...extra })));
  const row = async (id) => (await db().execute({ sql: "SELECT c.owner_user_id, c.version, c.stage, o.last_sent_by, o.uncertain_at, o.lease_token FROM crm_contacts c LEFT JOIN crm_outreach o ON o.contact_id = c.id WHERE c.id = ?", args: [id] })).rows[0];
  const sentTo = (a) => sent.filter((m) => [...m.to, ...m.cc].includes(a)).length;
  const clearLog = () => db().execute("DELETE FROM email_send_log"); // keep the per-person rate limit out of the way

  // 1. Free contact: no warning, sent, assigned to the sender only after the real success; stage untouched; audited.
  const v0 = Number((await row(C(1))).version);
  let r = await mail("u-bea", "free@x.test");
  assert.ok(r.ok, r.error); assert.match(r.ok, /seguito da te/);
  let x = await row(C(1));
  assert.equal(x.owner_user_id, "u-bea"); assert.equal(Number(x.version), v0 + 1, "assignment bumps the PR14 version");
  assert.equal(x.stage, "nuovo"); assert.equal(x.last_sent_by, "u-bea"); assert.equal(x.lease_token, null, "lease released");
  const audit = (await db().execute({ sql: "SELECT details FROM audit_log WHERE action = 'crm.owner' AND target_id = ?", args: [C(1)] })).rows;
  assert.equal(audit.length, 1); assert.equal(JSON.parse(String(audit[0].details)).auto, "email");
  const crm = await import("../lib/crm.ts");
  assert.equal(await crm.setOwner(C(1), "u-ana", v0), "conflict", "a panel opened before the send cannot overwrite it blindly");
  console.log("ok success assigns (no owner -> sender), version bump, no stage change");

  // 2. Colleague owner: warning with real name, nothing sent; consent then sends without changing the owner.
  r = await mail("u-bea", "Ana <ana@x.test>");
  assert.ok(r.warning && !r.ok); assert.equal(sentTo("ana@x.test"), 0);
  assert.equal(r.warning.contacts.length, 1);
  assert.deepEqual([r.warning.contacts[0].reason, r.warning.contacts[0].ownerName, r.warning.contacts[0].ownerActive, r.warning.contacts[0].mailHref], ["owner_other", "Utente u-ana", true, `/admin/crm/${C(2)}/email`]);
  assert.equal(r.warning.generic, false); assert.equal(r.warning.updated, false);
  const forged = await mail("u-bea", "ana@x.test", { crmAck: "A".repeat(43) });
  assert.ok(forged.warning && forged.warning.updated, "forged consent refused");
  const anaAck = (await as("u-ana", () => O.outreachWarning({ id: "u-ana", name: "Utente u-ana", email: "u-ana@t.test", roles: ["commerciale"], emailAccess: true }, ["ana@x.test"])));
  assert.equal(anaAck, null, "owner herself, nothing recent: no alarm");
  r = await mail("u-bea", "ana@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok, r.error); assert.doesNotMatch(r.ok, /seguito da te/);
  assert.equal(sentTo("ana@x.test"), 1); assert.equal((await row(C(2))).owner_user_id, "u-ana", "never overwritten");
  console.log("ok colleague owner: in-app warning, consent bound, owner kept");

  // 3. Owner is me but a colleague just wrote / I wrote minutes ago: managed, not silent.
  r = await mail("u-ana", "ana@x.test");
  assert.equal(r.warning?.contacts[0].reason, "recent"); assert.equal(r.warning.contacts[0].lastSentByName, "Utente u-bea");
  await clearLog();
  r = await mail("u-bea", "free@x.test");
  assert.equal(r.warning?.contacts[0].reason, "recent", "self owner, written minutes ago"); assert.equal(r.warning.contacts[0].lastSentByName, "te");
  console.log("ok self owner: no alarm when quiet, warning when recently written");

  // 4. Former member still shown as the real owner (no invented name), flagged as no longer on the team.
  r = await mail("u-bea", "ex@x.test");
  assert.deepEqual([r.warning.contacts[0].reason, r.warning.contacts[0].ownerName, r.warning.contacts[0].ownerActive], ["owner_other", "Utente u-ex", false]);
  r = await mail("u-bea", "ex@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok); assert.equal((await row(C(3))).owner_user_id, "u-ex", "former member's ownership is not silently taken over");
  console.log("ok former member owner");

  // 5. Already contacted, nobody responsible: notice without attributing anyone; after consent the sender takes it.
  r = await mail("u-bea", "contacted@x.test");
  assert.deepEqual([r.warning.contacts[0].reason, r.warning.contacts[0].ownerName, r.warning.contacts[0].lastSentByName], ["contacted_unassigned", null, null]);
  r = await mail("u-bea", "contacted@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok); x = await row(C(4)); assert.equal(x.owner_user_id, "u-bea"); assert.equal(x.stage, "contattato");
  r = await mail("u-ana", "won@x.test");
  assert.equal(r.warning.contacts[0].reason, "contacted_unassigned");
  r = await mail("u-ana", "won@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok); assert.equal((await row(C(5))).stage, "vinto", "won stays won");
  await clearLog();
  console.log("ok contacted without owner (stage kept, including vinto)");

  // 6. Stale consent: the owner changed (or a colleague wrote) after the warning -> updated warning, nothing sent.
  r = await mail("u-bea", "stale@x.test");
  const oldAck = r.warning.ack;
  await crm.setOwner(C(11), "u-ex", Number((await row(C(11))).version));
  const before = sent.length;
  r = await mail("u-bea", "stale@x.test", { crmAck: oldAck });
  assert.ok(r.warning?.updated, "updated warning"); assert.equal(r.warning.contacts[0].ownerName, "Utente u-ex"); assert.equal(sent.length, before);
  const ack2 = r.warning.ack;
  assert.ok((await mail("u-ana", "stale@x.test", { crmAck: ack2 })).warning, "a consent is personal: another user cannot reuse it");
  r = await mail("u-ana", "stale@x.test", { crmAck: (await mail("u-ana", "stale@x.test")).warning.ack });
  assert.ok(r.ok);
  r = await mail("u-bea", "stale@x.test", { crmAck: ack2 });
  assert.ok(r.warning?.updated, "a colleague's send in between invalidates the consent too");
  assert.equal(r.warning.contacts[0].lastSentByName, "Utente u-ana");
  await clearLog();
  console.log("ok stale and personal consent");

  // 7. Definite failure: nothing assigned, nothing recorded, lease released (next try is clean).
  behaviour = async (m) => { if (m.to.includes("fail@x.test")) throw new MailError("network", "Invio non riuscito, riprova tra poco."); };
  r = await mail("u-bea", "fail@x.test");
  assert.match(r.error, /non riuscito/); x = await row(C(9));
  assert.equal(x.owner_user_id, null); assert.equal(x.last_sent_by, null); assert.equal(x.lease_token, null);
  behaviour = async () => {};
  r = await mail("u-bea", "fail@x.test");
  assert.ok(r.ok, "retry after a definite failure is not blocked"); assert.equal((await row(C(9))).owner_user_id, "u-bea");
  // Someone takes the contact while our SMTP call is in flight: the success never overwrites them.
  behaviour = async (m) => { if (m.to.includes("mid@x.test")) await crm.setOwner(C(17), "u-ana", Number((await row(C(17))).version)); };
  r = await mail("u-bea", "mid@x.test");
  assert.ok(r.ok); assert.doesNotMatch(r.ok, /seguito da te/); assert.equal((await row(C(17))).owner_user_id, "u-ana");
  behaviour = async () => {};
  console.log("ok failure: no owner, no record; success never overwrites a concurrent owner");

  // 8. Unknown outcome: no assignment, the contact is flagged; a blind retry asks again, informed consent proceeds.
  behaviour = async () => { throw new MailError("uncertain", "x"); };
  const unsureKey = crypto.randomUUID();
  r = await mail("u-bea", "unsure@x.test", { sendKey: unsureKey });
  assert.ok(r.uncertain); assert.match(r.error, /incerto/); x = await row(C(10));
  assert.equal(x.owner_user_id, null); assert.ok(x.uncertain_at);
  behaviour = async () => {};
  r = await mail("u-bea", "unsure@x.test", { sendKey: unsureKey });
  assert.equal(r.warning?.contacts[0].reason, "uncertain", "blind resubmit stops at the warning");
  const s0 = sent.length;
  assert.match((await mail("u-bea", "unsure@x.test", { sendKey: unsureKey, crmAck: r.warning.ack })).error, /già inviata o in invio/, "same attempt key never sends twice");
  assert.equal(sent.length, s0);
  r = await mail("u-ana", "unsure@x.test");
  assert.equal(r.warning?.contacts[0].reason, "uncertain", "colleagues see it too");
  r = await mail("u-ana", "unsure@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok); x = await row(C(10)); assert.equal(x.uncertain_at, null); assert.equal(x.owner_user_id, "u-ana");
  behaviour = async () => { throw new Error("socket hang up"); };
  r = await mail("u-bea", "free2@x.test");
  assert.ok(r.uncertain, "unknown non-MailError errors are uncertain, not failures");
  behaviour = async () => {};
  await clearLog();
  console.log("ok uncertain outcome (no blind retry)");

  // 9. Two collaborators at the same moment: exactly one provider send; the other is told, then sees the new owner.
  behaviour = async (m) => { if (m.to.includes("race@x.test")) await new Promise((res) => setTimeout(res, 150)); };
  const [ra, rb] = await Promise.all([mail("u-ana", "race@x.test"), mail("u-bea", "race@x.test")]);
  assert.equal(sentTo("race@x.test"), 1, "exactly one provider send");
  const winner = ra.ok ? "u-ana" : "u-bea";
  const loser = ra.ok ? rb : ra;
  assert.ok(Boolean(ra.ok) !== Boolean(rb.ok), "one wins");
  assert.match(loser.error ?? "", /sta inviando proprio ora/); assert.equal((await row(C(6))).owner_user_id, winner);
  const after = await mail(winner === "u-ana" ? "u-bea" : "u-ana", "race@x.test");
  assert.equal(after.warning?.contacts[0].reason, "owner_other", "the loser's retry warns, never sends silently");
  assert.equal(sentTo("race@x.test"), 1);
  // Many at once, same contact, the same person double-clicking with one attempt key: still one send.
  await clearLog();
  const k = crypto.randomUUID();
  behaviour = async (m) => { if (m.to.includes("dup@x.test")) await new Promise((res) => setTimeout(res, 100)); };
  const dup = await Promise.all([1, 2, 3].map(() => mail("u-bea", "dup@x.test", { sendKey: k })));
  assert.equal(sentTo("dup@x.test"), 1); assert.equal(dup.filter((d) => d.ok).length, 1);
  const replay = await mail("u-bea", "dup@x.test", { sendKey: k });
  assert.equal(replay.warning?.contacts[0].reason, "recent", "replayed form after success: stops at the recent-send warning");
  assert.match((await mail("u-bea", "dup@x.test", { sendKey: k, crmAck: replay.warning.ack })).error, /già inviata/, "and even with consent the same attempt key is refused");
  assert.equal(sentTo("dup@x.test"), 1);
  const k2 = crypto.randomUUID();
  assert.ok((await mail("u-bea", "someone@else.test", { sendKey: k2 })).ok);
  assert.match((await mail("u-bea", "someone@else.test", { sendKey: k2 })).error, /già inviata/, "non-CRM recipients: replay refused by the attempt key");
  assert.equal(sentTo("someone@else.test"), 1);
  behaviour = async () => {};
  await clearLog();
  console.log("ok concurrency: one send per race, idempotent submit");

  // 10. Email without CRM: generic notice (no names/ids/links), consent works, never assigned.
  r = await mail("u-posta", "ana@x.test");
  assert.ok(r.warning); assert.equal(r.warning.generic, true); assert.deepEqual(r.warning.contacts, []);
  const leak = JSON.stringify(r);
  for (const s of ["Utente u-ana", C(2), "Contatto", "/admin/crm"]) assert.ok(!leak.includes(s), `no CRM leak: ${s}`);
  r = await mail("u-posta", "ana@x.test", { crmAck: r.warning.ack });
  assert.ok(r.ok);
  r = await mail("u-posta", "keep@x.test");
  assert.ok(r.ok); assert.equal((await row(C(16))).owner_user_id, null, "no CRM access: never made responsible");
  assert.match((await mail("u-nomail", "free2@x.test")).error, /non autorizzata/, "no Email permission, no send");
  assert.match((await as("u-nomail", () => A.sendDraftAction(C(14)))).error, /accesso alla casella/);
  assert.equal(await as("u-posta", async () => { try { await A.sendDraftAction(C(14)); return "sent"; } catch { return "refused"; } }), "refused", "Radar drafts need CRM");
  await clearLog();
  console.log("ok Email-only and disabled roles");

  // 11. Exact address only; archived contacts ignored; several recipients evaluated together.
  r = await mail("u-bea", "other@x.test");
  assert.ok(r.ok); assert.equal((await row(C(1))).owner_user_id, "u-bea"); assert.equal((await row(C(7))).owner_user_id, "u-bea", "only the exact address");
  r = await mail("u-bea", "arch@x.test"); assert.ok(r.ok); assert.equal((await row(C(8))).owner_user_id, null, "archived untouched");
  r = await mail("u-bea", "multi@x.test", { cc: "ana@x.test, unknown@else.test" });
  assert.deepEqual(r.warning?.contacts.map((c) => c.id), [C(2)], "only the flagged contact is listed");
  r = await mail("u-bea", "multi@x.test", { cc: "ana@x.test, unknown@else.test", crmAck: r.warning.ack });
  assert.ok(r.ok); assert.equal((await row(C(13))).owner_user_id, "u-bea"); assert.equal((await row(C(2))).owner_user_id, "u-ana");
  await clearLog();
  assert.equal((await mail("u-bea", "legacy@x.test")).warning?.contacts[0].id, C(18), "rows without email_norm still match exactly");
  console.log("ok exact matching, archived, multiple recipients, legacy rows");

  // 12. Radar draft send uses the same guard.
  await db().execute({ sql: "INSERT INTO crm_drafts (id, contact_id, subject, body_text) VALUES (?, ?, 'Il vostro sito', 'Buongiorno')", args: [C(901), C(2)] });
  await db().execute({ sql: "INSERT INTO crm_drafts (id, contact_id, subject, body_text) VALUES (?, ?, 'Il vostro sito', 'Buongiorno')", args: [C(902), C(14)] });
  r = await as("u-bea", () => A.sendDraftAction(C(901)));
  assert.equal(r.warning?.contacts[0].ownerName, "Utente u-ana");
  assert.equal((await db().execute({ sql: "SELECT sent_by FROM crm_drafts WHERE id = ?", args: [C(901)] })).rows[0].sent_by, null, "draft not claimed by a warning");
  r = await as("u-bea", () => A.sendDraftAction(C(901), r.warning.ack));
  assert.ok(r.ok, r.error); assert.equal((await row(C(2))).owner_user_id, "u-ana");
  r = await as("u-bea", () => A.sendDraftAction(C(902)));
  assert.ok(r.ok, r.error); x = await row(C(14)); assert.equal(x.owner_user_id, "u-bea"); assert.equal(x.stage, "contattato", "existing Radar nuovo -> contattato kept");
  console.log("ok Radar drafts share the guard");

  // 13. Composer opening (server) mirrors the send check and fails open only for display.
  const bea = { id: "u-bea", name: "Utente u-bea", email: "u-bea@t.test", roles: ["commerciale"], emailAccess: true };
  assert.equal((await O.composeOutreach(bea, "Ana <ana@x.test>", "")).contacts[0].reason, "owner_other");
  assert.equal(await O.composeOutreach(bea, "", ""), null);
  assert.equal(await O.composeOutreach(bea, "nobody@else.test", ""), null);
  console.log("ok compose-time check");

  console.log("crm outreach tests passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
