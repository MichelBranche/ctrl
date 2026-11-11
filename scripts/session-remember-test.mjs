/*
 * Remembered admin session, no network and no real secrets (temp SQLite, throwaway SESSION_SECRET):
 *   node scripts/session-remember-test.mjs
 * A checked "Resta collegato" is an absolute 72h httpOnly cookie issued only after password and 2FA.
 * The default stays 12h. Logout, expiry, a disabled account, a role change and a security change are re-checked.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { decodeJwt, SignJWT } from "jose";

const dir = mkdtempSync(join(tmpdir(), "ctrl-session-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD_HASH;
const PW = "remember-device-pass";
globalThis.__ip = "203.0.113.40";
globalThis.__jar = new Map();
globalThis.__opts = new Map();
globalThis.__sets = 0;
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":globalThis.__ip,"user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{
  get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,
  set:(n,v,o)=>{const name=typeof n==="object"?n.name:n;const value=typeof n==="object"?n.value:v;const opts=typeof n==="object"?n:(o||{});globalThis.__sets++;j.set(name,value);globalThis.__opts.set(name,opts)},
  delete:(n)=>{const name=typeof n==="object"&&n?n.name:n;j.delete(name);globalThis.__opts.delete(name)}
}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec === "@/lib/mail") return { url: "data:text/javascript," + encodeURIComponent("export function mailProvider(){return null}export const agencyAddress=()=>null"), shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const HOUR = 3600;
const key = new TextEncoder().encode(process.env.SESSION_SECRET);

try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  const A = await import("../lib/admin.ts");
  const T = await import("../lib/team-types.ts");
  const totp = await import("../lib/totp-core.ts");
  const tf = await import("../lib/two-factor.ts");
  const life = await import("../lib/session-lifetime.ts");
  assert.equal(life.SESSION_HOURS, 12);
  assert.equal(life.REMEMBER_HOURS, 72);

  const jar = globalThis.__jar;
  const opt = (name) => globalThis.__opts.get(name);
  const wipe = () => { jar.clear(); globalThis.__opts.clear(); };
  const claims = (name = A.SESSION_COOKIE) => decodeJwt(jar.get(name));
  const flags = (name = A.SESSION_COOKIE) => {
    const o = opt(name);
    assert.equal(o.httpOnly, true);
    assert.equal(o.sameSite, "strict");
    assert.equal(o.path, name === A.PENDING_COOKIE ? "/admin" : "/");
    assert.equal(o.secure, process.env.NODE_ENV === "production");
    assert.equal(typeof o.maxAge, "number");
    assert.ok(o.maxAge > 0);
    return o;
  };

  const hash = await A.hashPassword(PW);
  const add = async (id, email, role) => {
    await db().execute({
      sql: "INSERT INTO admin_users (id, email, name, password_hash, role, active) VALUES (?, ?, 'Test', ?, ?, 1)",
      args: [id, email, hash, role === "founder" ? "founder" : "member"],
    });
    await db().execute({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, role] });
  };
  await add("d1", "designer@test.invalid", "designer");
  await add("f1", "founder@test.invalid", "founder");
  await add("m1", "member@test.invalid", "designer");

  // 1. Default is 12h and survives a restarted browser only because Max-Age is set. Opt-in is 72h, not a local flag.
  assert.equal(await A.login("designer@test.invalid", PW), "ok");
  assert.equal((await A.getAdmin())?.id, "d1");
  let c = claims();
  assert.equal(c.exp - c.iat, 12 * HOUR);
  assert.equal(flags().maxAge, 12 * HOUR);
  assert.equal(c.rm, undefined, "the session token has no client-writable remember flag");
  assert.equal(jar.get(A.SESSION_COOKIE).includes(PW), false);
  const kept = jar.get(A.SESSION_COOKIE);
  wipe();
  jar.set(A.SESSION_COOKIE, kept);
  assert.equal((await A.getAdmin())?.id, "d1", "reopen: the same cookie still authenticates");
  const sets = globalThis.__sets;
  await A.getAdmin();
  assert.equal(globalThis.__sets, sets, "a later request does not slide the expiry");

  wipe();
  assert.equal(await A.login("designer@test.invalid", PW, true), "ok");
  c = claims();
  assert.equal(c.exp - c.iat, 72 * HOUR);
  assert.equal(flags().maxAge, 72 * HOUR);
  assert.deepEqual(Object.keys(c).sort(), ["aud", "exp", "iat", "sub", "sv"]);
  wipe();
  assert.equal(await A.login("designer@test.invalid", PW, "1"), "ok", "only boolean true opts in");
  assert.equal(claims().exp - claims().iat, 12 * HOUR);

  // 2. Expired and tampered cookies fail on the server even if the browser still sends them.
  const expired = await new SignJWT({ sv: 1 }).setSubject("d1").setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - 120).setExpirationTime(Math.floor(Date.now() / 1000) - 30).setAudience("ctrl-admin").sign(key);
  jar.set(A.SESSION_COOKIE, expired);
  assert.equal(await A.getAdmin(), null, "absolute expiry is enforced server-side");
  jar.set(A.SESSION_COOKIE, kept.slice(0, -4) + "xxxx");
  assert.equal(await A.getAdmin(), null, "tampered cookie");

  // 3. Password change kills the old cookie and does not grant a fresh 72h.
  wipe();
  assert.equal(await A.login("designer@test.invalid", PW, true), "ok");
  const beforePw = claims();
  const oldPw = jar.get(A.SESSION_COOKIE);
  assert.equal(await A.changePassword(PW, "new-password-123456", "new-password-123456"), "ok");
  const afterPw = claims();
  assert.equal(afterPw.exp, beforePw.exp, "absolute deadline unchanged");
  assert.notEqual(afterPw.sv, beforePw.sv);
  assert.equal((await A.getAdmin())?.id, "d1");
  jar.set(A.SESSION_COOKIE, oldPw);
  assert.equal(await A.getAdmin(), null, "cookie from before the password change is dead");

  // 4. Account disable and permission changes apply on the next request, without waiting for expiry.
  wipe();
  assert.equal(await A.login("designer@test.invalid", "new-password-123456", true), "ok");
  const live = jar.get(A.SESSION_COOKIE);
  assert.equal(await A.guardSection("journal").then((u) => u.id), "d1");
  await assert.rejects(() => A.guardSection("shop"), /unauthorized/);
  await db().execute("UPDATE admin_users SET active = 0 WHERE id = 'd1'");
  assert.equal(await A.getAdmin(), null, "disabled account");
  await db().execute("UPDATE admin_users SET active = 1 WHERE id = 'd1'");
  jar.set(A.SESSION_COOKIE, live);
  assert.equal((await A.getAdmin())?.emailAccess, false);
  assert.equal(T.canAccess(await A.getAdmin(), "email"), false);
  await db().execute("UPDATE admin_users SET email_access = 1 WHERE id = 'd1'");
  const allowed = await A.getAdmin();
  assert.equal(allowed.emailAccess, true);
  assert.equal(T.canAccess(allowed, "email"), true);
  await db().batch([
    { sql: "DELETE FROM admin_user_roles WHERE user_id = 'd1'", args: [] },
    { sql: "INSERT INTO admin_user_roles (user_id, role) VALUES ('d1', 'esterno')", args: [] },
  ], "write");
  assert.equal(jar.get(A.SESSION_COOKIE), live, "the cookie itself is not rewritten on a permission change");
  const narrowed = await A.getAdmin();
  assert.equal(narrowed?.id, "d1");
  assert.equal(T.canAccess(narrowed, "journal"), false);
  await assert.rejects(() => A.guardSection("journal"), /unauthorized/);

  // 5. Logout clears the cookie and the copied token fails.
  await db().execute("UPDATE admin_user_roles SET role = 'designer' WHERE user_id = 'd1'");
  wipe();
  assert.equal(await A.login("designer@test.invalid", "new-password-123456"), "ok");
  const copied = jar.get(A.SESSION_COOKIE);
  await A.logout();
  assert.equal(jar.has(A.SESSION_COOKIE), false);
  jar.set(A.SESSION_COOKIE, copied);
  assert.equal(await A.getAdmin(), null, "logout revoked the server session");

  // 6. 2FA: remember does not authenticate, and does not lengthen the ticket, until the code succeeds.
  const enrolled = async (id, email) => {
    const setup = await tf.beginSetup(id, email);
    const secret = totp.base32Decode(setup.secret);
    const codes = await tf.confirmSetup(id, totp.totp(secret, Date.now()));
    return { secret, codes };
  };
  const { secret, codes } = await enrolled("m1", "member@test.invalid");
  wipe();
  assert.equal(await A.login("member@test.invalid", PW, true), "2fa");
  assert.equal(await A.getAdmin(), null);
  assert.equal(jar.has(A.SESSION_COOKIE), false);
  assert.equal(flags(A.PENDING_COOKIE).maxAge, 5 * 60, "remember does not extend the 2FA ticket");
  assert.equal(claims(A.PENDING_COOKIE).rm, 1);
  const pending = jar.get(A.PENDING_COOKIE);
  jar.set(A.SESSION_COOKIE, pending);
  assert.equal(await A.getAdmin(), null, "a 2FA ticket is not a session");
  jar.delete(A.SESSION_COOKIE);
  const parts = pending.split(".");
  const forged = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  forged.rm = 0;
  jar.set(A.PENDING_COOKIE, `${parts[0]}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${parts[2]}`);
  assert.equal(await A.verifySecondStep(totp.hotp(secret, totp.stepAt(Date.now()) + 1)), "expired");
  assert.equal(jar.has(A.SESSION_COOKIE), false, "an edited ticket cannot change the lifetime");

  wipe();
  assert.equal(await A.login("member@test.invalid", PW, true), "2fa");
  assert.equal(await A.verifySecondStep("000000"), "invalid");
  assert.equal(await A.getAdmin(), null, "wrong code, still signed out");
  assert.equal(await A.verifySecondStep(totp.hotp(secret, totp.stepAt(Date.now()) + 1)), "ok");
  c = claims();
  assert.equal(c.exp - c.iat, 72 * HOUR);
  assert.equal(flags().maxAge, 72 * HOUR);
  assert.equal((await A.getAdmin())?.id, "m1");
  const remembered = jar.get(A.SESSION_COOKIE);
  const rememberedExp = c.exp;

  // 7. Disabling 2FA revokes other copies and keeps this browser on the same deadline.
  const { disableTwoFactor } = await import("../app/(admin)/admin/two-factor-actions.ts");
  const off = new FormData();
  off.set("password", PW);
  off.set("code", codes[0]);
  assert.equal((await disableTwoFactor({}, off)).ok, "Verifica in due passaggi disattivata.");
  assert.equal(claims().exp, rememberedExp);
  assert.equal((await A.getAdmin())?.id, "m1");
  jar.set(A.SESSION_COOKIE, remembered);
  assert.equal(await A.getAdmin(), null, "cookie from before 2FA was disabled is dead");

  // 8. Founder: no session until setup finishes, including when remember was checked. Then a founder reset kills the member.
  wipe();
  assert.equal(await A.login("founder@test.invalid", PW, true), "setup");
  assert.equal(await A.getAdmin(), null);
  assert.equal(jar.has(A.SESSION_COOKIE), false);
  assert.equal(flags(A.PENDING_COOKIE).maxAge, 15 * 60);
  assert.equal(await A.finishForcedSetup(), "incomplete");
  assert.equal(jar.has(A.SESSION_COOKIE), false);
  assert.equal(await A.confirmForcedSetup("000000"), "invalid");
  assert.equal(jar.has(A.SESSION_COOKIE), false);
  const started = await A.startForcedSetup();
  assert.notEqual(started, "expired");
  const confirmed = await A.confirmForcedSetup(totp.totp(totp.base32Decode(started.secret), Date.now()));
  assert.ok(Array.isArray(confirmed.codes));
  assert.equal(jar.has(A.SESSION_COOKIE), false, "confirming 2FA still does not open a session");
  assert.equal(await A.finishForcedSetup(), "ok");
  assert.equal(claims().exp - claims().iat, 72 * HOUR);
  assert.equal((await A.getAdmin())?.id, "f1");
  const founderCookie = jar.get(A.SESSION_COOKIE);

  wipe();
  assert.equal(await A.login("member@test.invalid", PW), "ok", "2FA is off, so the password is enough again");
  const memberCookie = jar.get(A.SESSION_COOKIE);
  jar.set(A.SESSION_COOKIE, founderCookie);
  const { resetUserTwoFactor } = await import("../app/(admin)/admin/team-actions.ts");
  const reset = new FormData();
  reset.set("id", "m1");
  assert.equal((await resetUserTwoFactor({}, reset)).ok, "Verifica in due passaggi azzerata.");
  jar.set(A.SESSION_COOKIE, memberCookie);
  assert.equal(await A.getAdmin(), null, "founder reset revoked the member session");

  // 9. The sign-in form opts in only when the checkbox value is exactly "1".
  wipe();
  const { signIn } = await import("../app/(admin)/admin/actions.ts");
  const bare = new FormData();
  bare.set("email", "member@test.invalid");
  bare.set("password", PW);
  await assert.rejects(() => signIn({}, bare), /redirect \/admin/);
  assert.equal(claims().exp - claims().iat, 12 * HOUR);
  wipe();
  const box = new FormData();
  box.set("email", "member@test.invalid");
  box.set("password", PW);
  box.set("remember", "1");
  await assert.rejects(() => signIn({}, box), /redirect \/admin/);
  assert.equal(claims().exp - claims().iat, 72 * HOUR);
  assert.equal(flags().secure, false);
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    wipe();
    const again = new FormData();
    again.set("email", "member@test.invalid");
    again.set("password", PW);
    again.set("remember", "1");
    await assert.rejects(() => signIn({}, again), /redirect \/admin/);
    assert.equal(flags().secure, true);
    assert.equal(flags().httpOnly, true);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }

  console.log("session-remember-test: all passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
