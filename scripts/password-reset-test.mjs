/*
 * "Password dimenticata?" self-test, no network and no real secrets (temp SQLite file, throwaway SESSION_SECRET, mail mocked):
 *   node scripts/password-reset-test.mjs
 * Checks: only the SHA-256 of the token is stored, 30-minute expiry, single use, a new request kills the old link,
 * no account enumeration (same answer, same minimum time, no email), rate limit per account and per IP,
 * session_version bump (every session dies), lockouts cleared, no session created, 2FA still required, audit without secrets.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-pwreset-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.RESEND_API_KEY;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD_HASH;
const PW = "old-password-123456";
const NEW_PW = "brand-new-password-7890";
globalThis.__ip = "203.0.113.60";
globalThis.__jar = new Map();
globalThis.__sent = [];
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":globalThis.__ip,"user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{
  get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,
  set:(n,v)=>{const name=typeof n==="object"?n.name:n;const value=typeof n==="object"?n.value:v;j.set(name,value)},
  delete:(n)=>{j.delete(typeof n==="object"&&n?n.name:n)}
}}`;
const mailStub = "export async function sendTransactional(m){globalThis.__sent.push(m);return{messageId:'x',via:'resend'}}";
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec === "@/lib/mail") return { url: "data:text/javascript," + encodeURIComponent("export function mailProvider(){return null}export const agencyAddress=()=>null"), shortCircuit: true };
    if (spec === "@/lib/mail/transactional") return { url: "data:text/javascript," + encodeURIComponent(mailStub), shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const tick = () => new Promise((r) => setTimeout(r, 20));
const timed = async (fn) => { const t0 = Date.now(); await fn(); return Date.now() - t0; };
const tokenOf = (mail) => new URL(mail.cta.href).searchParams.get("token");

try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const A = await import("../lib/admin.ts");
  const R = await import("../lib/password-reset.ts");
  const C = await import("../lib/password-reset-core.ts");
  await (await import("../lib/migrate.ts")).ensureTeamSchema();

  const hash = await A.hashPassword(PW);
  const add = async (id, email, role, extra = "") => {
    await db().execute({ sql: `INSERT INTO admin_users (id, email, name, password_hash, role, active${extra ? ", invite_state" : ""}) VALUES (?, ?, 'Test Person', ?, ?, ${extra ? "0, 'pending'" : "1"})`, args: [id, email, hash, role === "founder" ? "founder" : "member"] });
    await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, role] });
  };
  await add("d1", "designer@test.invalid", "designer");
  await add("f1", "founder@test.invalid", "founder");
  await add("p1", "pending@test.invalid", "designer", "pending");
  const sv = async (id) => Number((await db().execute({ sql: "SELECT session_version FROM admin_users WHERE id = ?", args: [id] })).rows[0].session_version);
  const rows = async (id) => (await db().execute({ sql: "SELECT * FROM admin_password_resets WHERE user_id = ?", args: [id] })).rows;

  // 1. Pure rules.
  const tk = C.newResetToken();
  assert.ok(C.resetTokenShapeOk(tk));
  assert.equal(C.hashResetToken(tk), createHash("sha256").update(tk).digest("base64url"));
  assert.equal(C.resetTokenShapeOk("short"), false);
  assert.equal(C.resetTokenShapeOk(undefined), false);
  assert.equal(C.RESET_TTL_MS, 30 * 60_000);
  console.log("ok core");

  // 2. Known address: an email with the link; the DB keeps only the hash.
  globalThis.__ip = "203.0.113.1";
  const tKnown = await timed(() => R.requestPasswordReset(" Designer@Test.invalid ", "it"));
  await tick();
  assert.equal(globalThis.__sent.length, 1);
  const m1 = globalThis.__sent[0];
  assert.deepEqual(m1.to, ["designer@test.invalid"]);
  assert.match(m1.cta.href, /^https:\/\/www\.ctrlagency\.dev\/admin\/login\/reimposta\?token=[A-Za-z0-9_-]{43}$/);
  assert.match(m1.subject, /Reimposta la password/);
  assert.match(m1.text, /^Ciao Test,/);
  const t1 = tokenOf(m1);
  const r1 = await rows("d1");
  assert.equal(r1.length, 1);
  assert.equal(r1[0].token_hash, C.hashResetToken(t1));
  assert.ok(!JSON.stringify(r1).includes(t1), "token never stored in clear");
  assert.ok(Math.abs(Number(r1[0].expires_at) - Number(r1[0].created_at) - 30 * 60_000) < 5);
  assert.equal(await R.readReset(t1), "valid");
  console.log("ok request + hash only");

  // 3. No enumeration: unknown and not-yet-accepted accounts get no email, same minimum time, nothing stored.
  globalThis.__ip = "203.0.113.2";
  const tUnknown = await timed(() => R.requestPasswordReset("nobody@test.invalid", "it"));
  const tPending = await timed(() => R.requestPasswordReset("pending@test.invalid", "it"));
  await tick();
  assert.equal(globalThis.__sent.length, 1, "no email for unknown or pending accounts");
  assert.equal((await rows("p1")).length, 0);
  for (const ms of [tKnown, tUnknown, tPending]) assert.ok(ms >= C.RESET_MIN_RESPONSE_MS - 5, `min response time (${ms}ms)`);
  assert.ok(Math.abs(tKnown - tUnknown) < 400, `similar timing known/unknown (${tKnown} vs ${tUnknown})`);
  console.log("ok no enumeration");

  // 4. A new request kills the old link.
  globalThis.__ip = "203.0.113.3";
  await R.requestPasswordReset("designer@test.invalid", "en");
  await tick();
  const m2 = globalThis.__sent.at(-1);
  assert.match(m2.subject, /Reset your CTRL® Admin password/, "email follows the requester's language");
  const t2 = tokenOf(m2);
  assert.equal(await R.readReset(t1), "invalid", "old link no longer valid");
  assert.equal(await R.readReset(t2), "valid");
  assert.equal((await rows("d1")).length, 1);
  console.log("ok new request replaces old");

  // 5. Expiry (30 minutes).
  const later = Date.now() + 31 * 60_000;
  assert.equal(await R.readReset(t2, later), "expired");
  assert.equal(await R.resetPassword(t2, NEW_PW, "it", later), "invalid");
  assert.equal(await R.readReset(t2), "valid", "an expired attempt does not consume the token");
  console.log("ok expiry");

  // 6. Reset: every session dies, lockouts cleared, single use, no session created, notice email.
  globalThis.__ip = "203.0.113.4";
  assert.equal(await A.login("designer@test.invalid", PW), "ok");
  const oldCookie = globalThis.__jar.get(A.SESSION_COOKIE);
  assert.ok(oldCookie);
  await db().execute({ sql: "INSERT OR REPLACE INTO login_attempts (key, failures, first_at, locked_til) VALUES (?, 10, ?, ?)", args: [A.accountKey("designer@test.invalid"), Date.now(), Date.now() + 15 * 60_000] });
  assert.equal(await A.login("designer@test.invalid", PW), "locked");
  const before = await sv("d1");
  globalThis.__jar.clear();
  const sentBefore = globalThis.__sent.length;
  assert.equal(await R.resetPassword(t2, NEW_PW, "it"), "ok");
  await tick();
  assert.equal(await sv("d1"), before + 1, "session_version bumped");
  assert.equal(globalThis.__jar.has(A.SESSION_COOKIE), false, "reset never signs in");
  globalThis.__jar.set(A.SESSION_COOKIE, oldCookie);
  assert.equal(await A.getAdmin(), null, "session from before the reset is dead");
  globalThis.__jar.clear();
  assert.equal((await db().execute({ sql: "SELECT 1 FROM login_attempts WHERE key = ?", args: [A.accountKey("designer@test.invalid")] })).rows.length, 0, "account lockout cleared");
  assert.equal(globalThis.__sent.length, sentBefore + 1);
  assert.match(globalThis.__sent.at(-1).subject, /è stata cambiata/);
  assert.equal(globalThis.__sent.at(-1).cta.href, "https://www.ctrlagency.dev/admin/login");
  assert.equal(await R.resetPassword(t2, "another-password-0000", "it"), "invalid", "single use");
  assert.equal(await R.readReset(t2), "invalid");
  assert.equal(await A.login("designer@test.invalid", PW), "invalid", "old password refused");
  assert.equal(await A.login("designer@test.invalid", NEW_PW), "ok", "new password works");
  console.log("ok reset");

  // 7. Founder: after a reset the next login still goes through 2FA (here: the mandatory setup), never straight in.
  globalThis.__ip = "203.0.113.5";
  await R.requestPasswordReset("founder@test.invalid", "it");
  await tick();
  globalThis.__jar.clear();
  assert.equal(await R.resetPassword(tokenOf(globalThis.__sent.at(-1)), NEW_PW, "it"), "ok");
  assert.equal(globalThis.__jar.has(A.SESSION_COOKIE), false);
  assert.equal(await A.login("founder@test.invalid", NEW_PW), "setup", "2FA still required for the founder");
  console.log("ok founder 2FA");

  // 8. Rate limit: 3 per hour per account (from rotating IPs), 10 per hour per IP. Unknown addresses are counted too.
  globalThis.__sent.length = 0;
  await db().execute("DELETE FROM login_attempts WHERE key LIKE 'reset:%'"); // the earlier steps already used 2 of designer's 3
  for (let i = 0; i < 4; i++) {
    globalThis.__ip = `198.51.100.${i}`;
    await R.requestPasswordReset("designer@test.invalid", "it");
  }
  await tick();
  assert.equal(globalThis.__sent.length, 3, "4th request in the hour sends nothing");
  for (let i = 0; i < 4; i++) { globalThis.__ip = `198.51.100.${50 + i}`; await R.requestPasswordReset("ghost@test.invalid", "it"); }
  const ghost = (await db().execute({ sql: "SELECT failures, locked_til FROM login_attempts WHERE key = ?", args: [`reset:${A.accountKey("ghost@test.invalid")}`] })).rows[0];
  assert.ok(ghost && Number(ghost.locked_til) > Date.now(), "unknown address limited the same way");
  globalThis.__ip = "192.0.2.77";
  for (let i = 0; i < 10; i++) await R.requestPasswordReset(`x${i}@test.invalid`, "it");
  globalThis.__sent.length = 0;
  await db().execute("UPDATE login_attempts SET locked_til = 0, failures = 0 WHERE key LIKE 'reset:acct:%'");
  await R.requestPasswordReset("founder@test.invalid", "it");
  await tick();
  assert.equal(globalThis.__sent.length, 0, "IP over 10 per hour: nothing sent");
  globalThis.__ip = "192.0.2.78";
  await R.requestPasswordReset("founder@test.invalid", "it");
  await tick();
  assert.equal(globalThis.__sent.length, 1, "another IP still works");
  console.log("ok rate limit");

  // 9. Audit: both events, no token or password in the details.
  const audit = (await db().execute("SELECT action, details FROM audit_log WHERE action LIKE 'auth.password_reset%'")).rows;
  assert.ok(audit.some((r) => r.action === "auth.password_reset_requested"));
  assert.ok(audit.some((r) => r.action === "auth.password_reset"));
  const blob = JSON.stringify(audit);
  for (const secret of [t1, t2, NEW_PW, PW, C.hashResetToken(t2)]) assert.ok(!blob.includes(secret), "no secrets in the audit log");
  console.log("ok audit");
  console.log("password-reset-test: all passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
