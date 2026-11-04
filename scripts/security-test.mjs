/*
 * Security self-test, no network and no real secrets (temp SQLite, throwaway SESSION_SECRET and test founder):
 *   node scripts/security-test.mjs
 * Checks the Turso-backed rate limiter used by /api/chat (burst window, per-IP isolation, window reset),
 * the per-account password lockout (no enumeration, temporary, cleared on success) and the Panoramica scope.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-sec-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
const PW = "test-only-founder-password";
const salt = randomBytes(16);
process.env.ADMIN_EMAIL = "founder@test.invalid";
process.env.ADMIN_NAME = "Founder Test";
process.env.ADMIN_PASSWORD_HASH = `scrypt$32768$8$1$${salt.toString("base64url")}$${scryptSync(PW.normalize("NFKC"), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 << 20 }).toString("base64url")}`;

// next/headers stub: the client IP comes from globalThis.__ip, cookies live in a Map.
globalThis.__ip = "203.0.113.1";
globalThis.__jar = new Map();
const headersStub = `export async function headers(){return new Headers({"x-forwarded-for":globalThis.__ip,"user-agent":"test"})}
export async function cookies(){const j=globalThis.__jar;return{get:(n)=>j.has(n)?{name:n,value:j.get(n)}:undefined,set:(n,v)=>{j.set(typeof n==="object"?n.name:n,typeof n==="object"?n.value:v)},delete:(n)=>j.delete(n)}}`;
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec === "next/headers") return { url: "data:text/javascript," + encodeURIComponent(headersStub), shortCircuit: true };
    if (spec === "next/server") return { url: "data:text/javascript,export function after(f){return typeof f==='function'?f():f}", shortCircuit: true };
    if (spec === "next/cache") return { url: "data:text/javascript,export const cacheLife=()=>{},cacheTag=()=>{},revalidatePath=()=>{},revalidateTag=()=>{},updateTag=()=>{}", shortCircuit: true };
    if (spec === "next/navigation") return { url: "data:text/javascript,export function redirect(u){throw new Error('redirect '+u)}", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

try {
  const { db } = await import("../lib/db.ts");
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));

  // 1. Rate limiter (same calls as /api/chat: 20 per 10 min).
  const { allow } = await import("../lib/request-guard.ts");
  const W = 600_000;
  for (let i = 0; i < 20; i++) assert.equal(await allow("chat", 20, W), true, `hit ${i + 1} allowed`);
  assert.equal(await allow("chat", 20, W), false, "21st hit refused");
  globalThis.__ip = "203.0.113.2";
  assert.equal(await allow("chat", 20, W), true, "another IP has its own window");
  globalThis.__ip = "203.0.113.1";
  assert.equal(await allow("chat-day", 100, 86_400_000), true, "daily cap is a separate counter");
  await db().execute({ sql: "UPDATE rate_limits SET window_at = window_at - ? WHERE key LIKE 'chat:%'", args: [W + 1] });
  assert.equal(await allow("chat", 20, W), true, "window expired: allowed again");
  const raw = await db().execute("SELECT key FROM rate_limits");
  assert.ok(raw.rows.every((r) => !String(r.key).includes("203.0.113")), "raw IP never stored");
  console.log("ok rate limiter");

  // 2. Per-account lockout across rotating IPs.
  const admin = await import("../lib/admin.ts");
  const fails = (email) => db().execute({ sql: "SELECT failures, locked_til FROM login_attempts WHERE key = ?", args: [admin.accountKey(email)] });
  for (let i = 0; i < 10; i++) {
    globalThis.__ip = `198.51.100.${i}`;
    assert.equal(await admin.login("founder@test.invalid", "wrong-" + i), "invalid", `wrong ${i}`);
  }
  globalThis.__ip = "198.51.100.200";
  assert.equal(await admin.login("founder@test.invalid", PW), "locked", "account locked even from a fresh IP with the right password");
  // Unknown accounts get the same treatment (no enumeration).
  for (let i = 0; i < 10; i++) {
    globalThis.__ip = `192.0.2.${i}`;
    assert.equal(await admin.login("nobody@test.invalid", "x"), "invalid");
  }
  globalThis.__ip = "192.0.2.200";
  assert.equal(await admin.login("nobody@test.invalid", "x"), "locked", "unknown email locks the same way");
  // Lock is temporary.
  assert.ok(Number((await fails("founder@test.invalid")).rows[0].locked_til) <= Date.now() + 15 * 60_000 + 1000, "lock at most 15 min");
  await db().execute({ sql: "UPDATE login_attempts SET locked_til = ?, first_at = ? WHERE key = ?", args: [Date.now() - 1, Date.now() - 16 * 60_000, admin.accountKey("founder@test.invalid")] });
  globalThis.__ip = "198.51.100.201";
  const ok = await admin.login("founder@test.invalid", PW);
  assert.ok(ok !== "locked" && ok !== "invalid", `founder back in after expiry (${ok})`);
  assert.equal(admin.accountKey(" Founder@Test.invalid "), admin.accountKey("founder@test.invalid"), "key normalised");
  assert.ok(!admin.accountKey("founder@test.invalid").includes("founder"), "email not stored in clear");
  console.log("ok account lockout");

  // 3. Panoramica scope.
  const { overviewScope } = await import("../lib/overview-scope.ts");
  const f = overviewScope({ role: "founder", area: null });
  assert.deepEqual([f.traffic, f.requests, f.subscribers, f.posts, f.revenue, f.activity], [true, true, true, true, true, undefined]);
  const shop = overviewScope({ role: "member", area: "shop" });
  assert.equal(shop.revenue, false, "shop member sees no studio revenue");
  assert.equal(shop.traffic, false);
  assert.equal(shop.requests, true);
  assert.deepEqual(shop.activity, ["request", "order"]);
  const design = overviewScope({ role: "member", area: "design" });
  assert.deepEqual([design.traffic, design.requests, design.subscribers, design.posts, design.revenue], [false, false, false, true, false]);
  assert.deepEqual(design.activity, ["post"]);
  const none = overviewScope({ role: "member", area: null });
  assert.deepEqual([none.traffic, none.requests, none.subscribers, none.posts, none.revenue, none.activity.length], [false, false, false, false, false, 0]);
  console.log("ok overview scope");
  console.log("security-test: all passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
