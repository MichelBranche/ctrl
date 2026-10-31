import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, dbConfigured } from "@/lib/db";

/**
 * Single-admin auth, no third party.
 * ADMIN_EMAIL + ADMIN_PASSWORD_HASH (scrypt, made by scripts/hash-password.mjs) + SESSION_SECRET.
 * Everything fails closed: if any of them is missing nobody can sign in.
 */
export const SESSION_COOKIE = "ctrl_admin";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

const adminEmail = () => (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const secretKey = () => {
  const s = process.env.SESSION_SECRET ?? "";
  return s.length >= 32 ? new TextEncoder().encode(s) : null;
};

export const authConfigured = () => Boolean(adminEmail() && process.env.ADMIN_PASSWORD_HASH && secretKey() && dbConfigured);

function scryptAsync(password: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, len, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: scrypt$N$r$p$saltB64url$hashB64url */
async function verifyPassword(password: string, stored: string) {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

async function isLocked(key: string) {
  const res = await db().execute({ sql: "SELECT locked_til FROM login_attempts WHERE key = ?", args: [key] });
  return Number(res.rows[0]?.locked_til ?? 0) > Date.now();
}

async function recordFailure(key: string) {
  const now = Date.now();
  await db().execute({
    sql: `INSERT INTO login_attempts (key, failures, first_at, locked_til) VALUES (?1, 1, ?2, 0)
          ON CONFLICT(key) DO UPDATE SET
            failures = CASE WHEN first_at < ?2 - ?3 THEN 1 ELSE failures + 1 END,
            first_at = CASE WHEN first_at < ?2 - ?3 THEN ?2 ELSE first_at END,
            locked_til = CASE WHEN first_at >= ?2 - ?3 AND failures + 1 >= ?4 THEN ?2 + ?5 ELSE locked_til END`,
    args: [key, now, WINDOW_MS, MAX_FAILURES, LOCK_MS],
  });
}

export type LoginResult = "ok" | "invalid" | "locked" | "unconfigured";

export async function login(email: string, password: string): Promise<LoginResult> {
  if (!authConfigured()) return "unconfigured";
  const key = await clientKey();
  if (await isLocked(key)) return "locked";
  const emailOk = email.trim().toLowerCase() === adminEmail();
  // Always run scrypt so a wrong email costs the same time as a wrong password.
  const passOk = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!).catch(() => false);
  if (!emailOk || !passOk) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    return "invalid";
  }
  await db().execute({ sql: "DELETE FROM login_attempts WHERE key = ?", args: [key] });
  const token = await new SignJWT({ sub: adminEmail() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setAudience("ctrl-admin")
    .sign(secretKey()!);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return "ok";
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Verifies the signed session cookie on every call. Returns null when not signed in or auth is unconfigured. */
export async function getAdmin() {
  if (!authConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey()!, { algorithms: ["HS256"], audience: "ctrl-admin" });
    if (payload.sub !== adminEmail()) return null;
    return { email: adminEmail() };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
