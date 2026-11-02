import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, dbConfigured } from "@/lib/db";
import { ensureTeamSchema } from "@/lib/migrate";
import { canAccess, isArea, isRole, type Area, type Role, type Section } from "@/lib/team-types";

/**
 * Multi-user admin auth, no third party. Accounts live in admin_users (scrypt hashes), sessions are signed
 * JWT cookies (SESSION_SECRET) bound to a user id + session_version, re-checked against the DB on every request.
 *
 * Migration from the old single-admin login: the first time the team tables are used, a founder account
 * (id 'founder') is seeded with ADMIN_EMAIL and the password that worked before: the dashboard override in
 * settings.admin_password_hash if one was set, else ADMIN_PASSWORD_HASH. Same email + same password, no lockout.
 * After that the founder row is the source of truth; the env hash is only used for seeding.
 * Everything fails closed: without SESSION_SECRET or a DB nobody can sign in.
 */
const PASSWORD_SETTING = "admin_password_hash";
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

export const authConfigured = () => Boolean(secretKey() && dbConfigured);

function scryptAsync(password: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, len, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: scrypt$N$r$p$saltB64url$hashB64url */
export async function verifyPassword(password: string, stored: string) {
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

export async function hashPassword(password: string) {
  const N = 32768, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}


// A valid hash of a random password: verifying against it keeps unknown-email logins as slow as real ones.
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword(randomBytes(24).toString("hex")));

let founderSeed: Promise<void> | null = null;

/** Creates the tables and seeds the founder from the legacy single-admin login. Idempotent (INSERT OR IGNORE on a fixed id). */
export function ensureTeam(): Promise<void> {
  founderSeed ??= (async () => {
    await ensureTeamSchema();
    const email = adminEmail();
    if (!email) return;
    const override = await db().execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [PASSWORD_SETTING] }).catch(() => null);
    const hash = override?.rows[0]?.value ? String(override.rows[0].value) : process.env.ADMIN_PASSWORD_HASH;
    if (!hash) return;
    // OR IGNORE: a concurrent instance may have seeded it already, or a member may already use this email.
    await db().execute({
      sql: "INSERT OR IGNORE INTO admin_users (id, email, name, role, area, password_hash) VALUES ('founder', ?, 'Founder', 'founder', NULL, ?)",
      args: [email, hash],
    });
  })().catch((error) => {
    founderSeed = null;
    throw error;
  });
  return founderSeed;
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  area: Area | null;
  emailAccess: boolean;
  issuedAt: number;
  expiresAt: number;
};

export type ChangeResult = "ok" | "wrong" | "weak" | "mismatch" | "locked";

export const passwordOk = (pw: string) => pw.length >= 12 && pw.length <= 500;

/** Verifies the user's current password (same lockout as login), stores a new hash and signs out their other sessions. */
export async function changePassword(current: string, next: string, confirm: string): Promise<ChangeResult> {
  const me = await getAdmin();
  if (!me) return "wrong";
  const key = await clientKey();
  if (await isLocked(key)) return "locked";
  const row = await db().execute({ sql: "SELECT password_hash FROM admin_users WHERE id = ?", args: [me.id] });
  const ok = await verifyPassword(current, String(row.rows[0]?.password_hash ?? "")).catch(() => false);
  if (!ok) {
    await recordFailure(key);
    return "wrong";
  }
  if (!passwordOk(next)) return "weak";
  if (next !== confirm) return "mismatch";
  const res = await db().execute({
    sql: `UPDATE admin_users SET password_hash = ?, session_version = session_version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? RETURNING session_version`,
    args: [await hashPassword(next), me.id],
  });
  await issueSession(me.id, Number(res.rows[0]?.session_version ?? 1));
  return "ok";
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

async function issueSession(userId: string, version: number) {
  const token = await new SignJWT({ sv: version })
    .setSubject(userId)
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
}

export type LoginResult = "ok" | "invalid" | "locked" | "unconfigured";

export async function login(email: string, password: string): Promise<LoginResult> {
  if (!authConfigured()) return "unconfigured";
  await ensureTeam();
  const key = await clientKey();
  if (await isLocked(key)) return "locked";
  const res = await db().execute({
    sql: "SELECT id, password_hash, session_version FROM admin_users WHERE email = ? AND active = 1",
    args: [email.trim().toLowerCase()],
  });
  const row = res.rows[0];
  // Always run scrypt so an unknown email costs the same time as a wrong password.
  const passOk = await verifyPassword(password, row ? String(row.password_hash) : await dummyHash()).catch(() => false);
  if (!row || !passOk) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    return "invalid";
  }
  await db().batch([
    { sql: "DELETE FROM login_attempts WHERE key = ?", args: [key] },
    { sql: "UPDATE admin_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [String(row.id)] },
  ], "write");
  await issueSession(String(row.id), Number(row.session_version));
  return "ok";
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Verifies the signed session cookie and re-reads the account on every request (deduped per request):
 * a disabled user, a changed role/area or a password change (session_version bump) takes effect immediately.
 */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  // Read the cookie first so the check is always request-time, never baked into a prerender.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!authConfigured() || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey()!, { algorithms: ["HS256"], audience: "ctrl-admin" });
    if (!payload.sub) return null;
    await ensureTeam();
    const res = await db().execute({
      sql: "SELECT id, email, name, role, area, email_access, session_version FROM admin_users WHERE id = ? AND active = 1",
      args: [payload.sub],
    });
    const u = res.rows[0];
    if (!u || Number(u.session_version) !== Number(payload.sv)) return null;
    const role = isRole(u.role) ? u.role : "member";
    return {
      id: String(u.id),
      email: String(u.email),
      name: String(u.name),
      role,
      area: isArea(u.area) ? u.area : null,
      emailAccess: role === "founder" || Number(u.email_access) === 1,
      issuedAt: Number(payload.iat ?? 0) * 1000,
      expiresAt: Number(payload.exp ?? 0) * 1000,
    };
  } catch {
    return null;
  }
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For pages: signed in and allowed to use this section, else back to the overview. */
export async function requireSection(section: Section) {
  const admin = await requireAdmin();
  if (!canAccess(admin, section)) redirect("/admin?negato=1");
  return admin;
}

/** For server actions and route handlers: throws unless signed in and allowed to use this section. */
export async function guardSection(section: Section) {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, section)) throw new Error("unauthorized");
  return admin;
}
