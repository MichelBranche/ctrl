/*
 * Team roles + invites + offboarding self-test, no network and no real secrets (temp SQLite, mail captured in memory):
 *   node scripts/team-invite-test.mjs
 * Checks the permission union and founder rules, the legacy backfill, invite single-use / expiry / revoke / rate limit,
 * the email CTA, sign-in after acceptance, soft removal (sessions killed, login refused, history kept) and reactivation.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-team-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD_HASH;
globalThis.__ip = "203.0.113.9";
globalThis.__jar = new Map();
globalThis.__sent = [];
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":globalThis.__ip,"user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:(n,v)=>{j.set(typeof n==="object"?n.name:n,typeof n==="object"?n.value:v)},delete:(n)=>j.delete(n)}}`;
const mailStub = `export function mailProvider(){return{send:async(m)=>{globalThis.__sent.push(m);return{}}}};export const agencyAddress=()=>"agenzia@example.test"`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "@/lib/mail") return { url: "data:text/javascript," + encodeURIComponent(mailStub), shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

try {
  // 1. Permission map: union of roles, founder-only sections, email gated.
  const T = await import("../lib/team-types.ts");
  const p = (roles, s, emailAccess = false) => T.canAccess({ roles, emailAccess }, s);
  assert.ok(p(["designer"], "media") && !p(["designer"], "shop"));
  assert.ok(p(["designer", "ecommerce"], "media") && p(["designer", "ecommerce"], "shop"), "union of roles");
  assert.deepEqual([...T.permissionsFor(["designer", "ecommerce"])].sort(), [...new Set([...T.permissionsFor(["designer"]), ...T.permissionsFor(["ecommerce"])])].sort());
  for (const r of T.TEAM_ROLES.filter((r) => r !== "founder")) {
    assert.ok(!p([r], "team") && !p([r], "audit"), `${r}: no founder-only section`);
    for (const s of T.EVERYONE) assert.ok(p([r], s), `${r}: ${s}`);
  }
  assert.ok(!p(["esterno"], "journal") && !p(["esterno"], "email"));
  assert.ok(!p(["marketing"], "email") && p(["marketing"], "email", true), "email needs emailAccess");
  for (const s of Object.keys(T.SECTION_HREF)) assert.ok(p(["founder"], s), `founder: ${s}`);
  assert.ok(T.isFounder(["designer", "founder"]) && !T.isFounder(["designer"]) && T.isFounder({ roles: ["founder"] }));
  assert.deepEqual(T.normalizeRoles(["x", "seo", "founder", "seo"]), ["founder", "seo"]);
  const { twoFactorRequired } = await import("../lib/two-factor-policy.ts");
  assert.equal(twoFactorRequired(["designer", "founder"]), true);
  assert.equal(twoFactorRequired(["designer"]), false);
  console.log("ok permissions");

  // 2. Schema + legacy backfill (founder/area rows get roles, unknown -> esterno).
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const { ensureTeamSchema } = await import("../lib/migrate.ts");
  await ensureTeamSchema();
  const A = await import("../lib/admin.ts");
  const fh = await A.hashPassword("founder-password-123");
  await db().batch([
    { sql: "INSERT INTO admin_users (id, email, name, password_hash, role, area, active) VALUES ('f1','f@t.test','Fondatore Uno',?, 'founder', NULL, 1)", args: [fh] },
    { sql: "INSERT INTO admin_users (id, email, name, password_hash, role, area, active) VALUES ('m1','m@t.test','Maria Rossi',?, 'member', 'sviluppo', 1)", args: [fh] },
    { sql: "INSERT INTO admin_users (id, email, name, password_hash, role, area, active) VALUES ('m2','x@t.test','Ext',?, 'member', NULL, 1)", args: [fh] },
  ], "write");
  await (await import("../lib/migrate.ts")).backfillRoles();
  const rolesOf = async (id) => (await db().execute({ sql: "SELECT role FROM admin_user_roles WHERE user_id = ? ORDER BY role", args: [id] })).rows.map((r) => r.role);
  assert.deepEqual(await rolesOf("f1"), ["founder"]);
  assert.deepEqual(await rolesOf("m1"), ["dev_frontend"]);
  assert.deepEqual(await rolesOf("m2"), ["esterno"]);
  await (await import("../lib/migrate.ts")).backfillRoles();
  assert.deepEqual(await rolesOf("m1"), ["dev_frontend"], "backfill idempotent");
  console.log("ok backfill");

  // 3. Invite: pending user cannot log in, single use, expiry, revoke, rate limit, CTA.
  const I = await import("../lib/team-invite.ts");
  const core = await import("../lib/team-invite-core.ts");
  await db().batch([
    { sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active) VALUES ('n1','n@t.test','Nuovo Membro','!', 'member', 0)", args: [] },
    { sql: "INSERT INTO admin_user_roles (user_id, role) VALUES ('n1','designer'), ('n1','seo')", args: [] },
  ], "write");
  const inviter = { id: "f1", name: "Fondatore Uno" };
  assert.deepEqual(await I.sendInvite("n1", inviter, "sent"), { ok: true });
  const mail = globalThis.__sent.at(-1);
  assert.deepEqual(mail.to, ["n@t.test"]);
  assert.equal(mail.cta.label, "Accetta l'invito");
  const token = mail.cta.href.split("/").pop();
  assert.ok(core.tokenShapeOk(token));
  assert.ok(!/password\s*:/i.test(mail.text) && mail.text.includes("48 ore"), "no password in the email");
  const stored = (await db().execute("SELECT invite_hash FROM admin_users WHERE id='n1'")).rows[0].invite_hash;
  assert.equal(stored, core.hashInviteToken(token)); assert.notEqual(stored, token, "only the hash is stored");
  const { brandedEmail } = await import("../lib/mail/template.ts");
  const be = brandedEmail("Ciao", { cta: mail.cta });
  assert.ok(be.html.includes(mail.cta.href) && be.html.includes("Accetta l") && be.text.includes(mail.cta.href));
  assert.ok(!brandedEmail("x", { cta: { label: "y", href: "javascript:alert(1)" } }).html.includes("javascript:"), "https-only CTA");
  assert.equal(await A.login("n@t.test", "anything-at-all-123"), "invalid", "invited user cannot log in");
  assert.equal((await I.sendInvite("n1", inviter, "resent")).ok, false, "resend within 2 minutes refused");
  assert.equal((await I.readInvite(token)).state, "valid");
  assert.equal((await I.readInvite(token, Date.now() + core.INVITE_TTL_MS + 1000)).state, "expired");
  assert.equal(await I.acceptInvite(token, "a-strong-password-42", Date.now() + core.INVITE_TTL_MS + 1000), null, "expired token refused");
  const acc = await I.acceptInvite(token, "a-strong-password-42");
  assert.equal(acc.id, "n1"); assert.deepEqual([...acc.roles].sort(), ["designer", "seo"]);
  assert.equal(await I.acceptInvite(token, "another-password-42"), null, "single use");
  assert.equal((await I.readInvite(token)).state, "invalid");
  assert.equal(await A.signInAfterInvite(acc), "ok", "non-founder: session right away");
  assert.equal((await A.getAdmin())?.id, "n1");
  globalThis.__jar.clear();
  assert.equal(core.resendCheck({ sentAt: 0, windowAt: Date.now(), windowCount: 5 }).ok, false, "5 per day cap");
  // Revoke: link dies. Founder invite leads to forced 2FA setup.
  await db().batch([
    { sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active) VALUES ('n2','n2@t.test','Socio Nuovo','!', 'founder', 0)", args: [] },
    { sql: "INSERT INTO admin_user_roles (user_id, role) VALUES ('n2','founder')", args: [] },
  ], "write");
  await I.sendInvite("n2", inviter, "sent");
  const t2 = globalThis.__sent.at(-1).cta.href.split("/").pop();
  assert.ok(globalThis.__sent.at(-1).text.includes("due passaggi"));
  assert.equal(await I.revokeInvite("n2"), true);
  assert.equal((await I.readInvite(t2)).state, "invalid", "revoked link");
  await db().execute("UPDATE admin_users SET invite_sent_at = 0 WHERE id = 'n2'");
  await I.sendInvite("n2", inviter, "resent");
  const t3 = globalThis.__sent.at(-1).cta.href.split("/").pop();
  const acc2 = await I.acceptInvite(t3, "founder-strong-pass-99");
  assert.equal(await A.signInAfterInvite(acc2), "setup", "founder: forced 2FA before any session");
  assert.equal(await A.getAdmin(), null);
  globalThis.__jar.clear();
  const audit = (await db().execute("SELECT action FROM audit_log")).rows.map((r) => r.action);
  for (const a of ["team.invite_sent", "team.invite_resent", "team.invite_revoked", "team.invite_accepted"]) assert.ok(audit.includes(a), a);
  console.log("ok invites");

  // 4. Offboarding: founders protected, member removed softly, session dies, history kept, reactivation.
  const D = await import("../lib/team-delete.ts");
  assert.equal(await D.removeMember("n2", "f1"), "founder");
  assert.equal(await D.removeMember("f1", "f1"), "self");
  assert.equal(await A.login("m@t.test", "founder-password-123"), "ok");
  assert.equal((await A.getAdmin())?.id, "m1");
  await db().execute("INSERT INTO audit_log (action, actor_id, actor_name) VALUES ('test.history', 'm1', 'Maria Rossi')").catch(() => {});
  assert.equal(await D.removeMember("m1", "f1"), "ok");
  assert.equal(await A.getAdmin(), null, "existing session revoked");
  globalThis.__jar.clear();
  assert.equal(await A.login("m@t.test", "founder-password-123"), "invalid", "removed cannot log in");
  const m = (await db().execute("SELECT name, email, removed_at, removed_by FROM admin_users WHERE id='m1'")).rows[0];
  assert.equal(m.name, "Maria Rossi"); assert.equal(m.email, "m@t.test"); assert.ok(m.removed_at); assert.equal(m.removed_by, "f1");
  assert.deepEqual(await rolesOf("m1"), ["dev_frontend"], "roles kept for reactivation");
  assert.equal((await I.sendInvite("m1", inviter, "sent")).ok, false, "no invite to removed people");
  const { listUsers } = await import("../lib/team.ts");
  const lm = (await listUsers()).find((u) => u.id === "m1");
  assert.equal(lm.status, "rimosso"); assert.equal(lm.removedBy, "Fondatore Uno");
  assert.equal(await D.reactivateMember("m1"), true);
  assert.equal((await db().execute("SELECT removed_at FROM admin_users WHERE id='m1'")).rows[0].removed_at, null);
  const { offboardingText, OFFBOARDING_SUBJECT } = await import("../lib/team-offboarding.ts");
  const ot = offboardingText("Maria Rossi", new Date("2026-11-04T10:00:00Z"));
  assert.ok(ot.startsWith("Gentile Maria,") && ot.includes("4 novembre 2026") && ot.includes("info@ctrlagency.dev") && !ot.includes("\u2014"));
  assert.ok(OFFBOARDING_SUBJECT.includes("Cessazione"));
  const a2 = (await db().execute("SELECT action FROM audit_log")).rows.map((r) => r.action);
  assert.ok(a2.includes("team.user_removed") && a2.includes("team.user_reactivated"));
  console.log("ok offboarding");
  console.log("team-invite-test: all passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
