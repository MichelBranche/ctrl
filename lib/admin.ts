import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { logAction } from "@/lib/audit";
import { avatarFor } from "@/lib/avatars";
import { db, dbConfigured } from "@/lib/db";
import { backfillRoles, ensureTeamSchema, ensureTwoFactorSchema } from "@/lib/migrate";
import { beginSetup, checkSecondFactor, confirmSetup, twoFactorEnabled, twoFactorStatus } from "@/lib/two-factor";
import { forcedSetupFinishable, loginNext, sessionAllowed } from "@/lib/two-factor-policy";
import { canAccess, isArea, isFounder, normalizeRoles, type Area, type Section, type TeamRole } from "@/lib/team-types";

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
/** Password ok, second factor still missing. Not a session: only /admin/login/verifica accepts it. */
export const PENDING_COOKIE = "ctrl_admin_2fa";
const PENDING_MINUTES = 5;
const SETUP_MINUTES = 15;
const AUD_CODE = "ctrl-admin-2fa";
const AUD_SETUP = "ctrl-admin-2fa-setup";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
/**
 * Per-account password lockout, on top of the per-IP one: stops slow guessing from many IPs against one email.
 * Higher threshold than per IP and always temporary (15 min, then the counter starts over), so an attacker can at most
 * delay a founder by minutes, never lock them out for good. Keyed on a hash of the submitted email whether or not
 * the account exists, and the answer is the same generic "locked" either way, so it reveals nothing about accounts.
 */
const ACCOUNT_MAX_FAILURES = 10;

/** SQL column: the account's roles as a comma list (admin_user_roles is the source of truth). */
export const ROLES_SQL = "(SELECT GROUP_CONCAT(r.role) FROM admin_user_roles r WHERE r.user_id = admin_users.id) AS roles";
/** Only accounts with no open or revoked invite may sign in (an invite must be accepted first). */
export const CAN_SIGN_IN_SQL = "active = 1 AND invite_state IS NULL AND removed_at IS NULL";
/** Roles from a row with `roles` (+ the legacy `role` column as a fail-safe so a founder is never treated as a member). */
export function rowRoles(r: Record<string, unknown>): TeamRole[] {
  const list = String(r.roles ?? "").split(",");
  if (r.role === "founder") list.push("founder");
  const roles = normalizeRoles(list);
  return roles.length ? roles : ["esterno"];
}
export const accountKey = (email: string) => `acct:${createHash("sha256").update(email.trim().toLowerCase()).digest("base64url").slice(0, 32)}`;

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
    // Seed only a brand-new install: once any account exists, a removed legacy founder must stay removed.
    const existing = await db().execute("SELECT 1 FROM admin_users LIMIT 1");
    if (existing.rows.length) {
      await backfillRoles();
      return;
    }
    // OR IGNORE: a concurrent instance may have seeded it already, or a member may already use this email.
    await db().execute({
      sql: "INSERT OR IGNORE INTO admin_users (id, email, name, role, area, password_hash) VALUES ('founder', ?, 'Founder', 'founder', NULL, ?)",
      args: [email, hash],
    });
    await backfillRoles();
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
  /** Display roles; permissions are their union (see lib/team-types.ts). */
  roles: TeamRole[];
  area: Area | null;
  avatarUrl: string | null;
  emailAccess: boolean;
  issuedAt: number;
  expiresAt: number;
};

export type ChangeResult = "ok" | "wrong" | "weak" | "mismatch" | "locked";

/** Re-checks the signed-in user's password with the login lockout (used to disable 2FA). */
export async function confirmOwnPassword(password: string): Promise<"ok" | "wrong" | "locked"> {
  const me = await getAdmin();
  if (!me) return "wrong";
  const key = await clientKey();
  if (await isLocked(key)) return "locked";
  const row = await db().execute({ sql: "SELECT password_hash FROM admin_users WHERE id = ?", args: [me.id] });
  if (await verifyPassword(password, String(row.rows[0]?.password_hash ?? "")).catch(() => false)) return "ok";
  await recordFailure(key);
  return "wrong";
}

/** Shared lockout for the 2FA step: per IP and per account, so rotating IPs does not buy more guesses. */
export async function secondFactorLocked(userId: string) {
  return (await isLocked(await clientKey())) || (await isLocked(`2fa:${userId}`));
}
export async function recordSecondFactorFailure(userId: string) {
  await recordFailure(await clientKey());
  await recordFailure(`2fa:${userId}`);
}

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
  await logAction("auth.password_change", { type: "user", id: me.id }, undefined, me);
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

async function recordFailure(key: string, max = MAX_FAILURES) {
  const now = Date.now();
  await db().execute({
    sql: `INSERT INTO login_attempts (key, failures, first_at, locked_til) VALUES (?1, 1, ?2, 0)
          ON CONFLICT(key) DO UPDATE SET
            failures = CASE WHEN first_at < ?2 - ?3 THEN 1 ELSE failures + 1 END,
            first_at = CASE WHEN first_at < ?2 - ?3 THEN ?2 ELSE first_at END,
            locked_til = CASE WHEN first_at >= ?2 - ?3 AND failures + 1 >= ?4 THEN ?2 + ?5 ELSE locked_til END`,
    args: [key, now, WINDOW_MS, max, LOCK_MS],
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

export type LoginResult = "ok" | "2fa" | "setup" | "invalid" | "locked" | "unconfigured";

async function setTicket(userId: string, sv: number, audience: string, minutes: number) {
  const ticket = await new SignJWT({ sv })
    .setSubject(userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .setAudience(audience)
    .sign(secretKey()!);
  (await cookies()).set(PENDING_COOKIE, ticket, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: minutes * 60,
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  if (!authConfigured()) return "unconfigured";
  await ensureTeam();
  const key = await clientKey();
  const acct = accountKey(email);
  if ((await isLocked(key)) || (await isLocked(acct))) return "locked";
  const res = await db().execute({
    sql: `SELECT id, name, email, role, ${ROLES_SQL}, password_hash, session_version FROM admin_users WHERE email = ? AND ${CAN_SIGN_IN_SQL}`,
    args: [email.trim().toLowerCase()],
  });
  const row = res.rows[0];
  // Always run scrypt so an unknown email costs the same time as a wrong password.
  const passOk = await verifyPassword(password, row ? String(row.password_hash) : await dummyHash()).catch(() => false);
  if (!row || !passOk) {
    await recordFailure(key);
    await recordFailure(acct, ACCOUNT_MAX_FAILURES);
    await logAction("auth.login_failed", undefined, { email: email.trim().toLowerCase().slice(0, 200) }, null);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    return "invalid";
  }
  const next = loginNext(rowRoles(row), await twoFactorEnabled(String(row.id)));
  // Password ok but no session yet: a signed ticket for the code step (5 min) or the mandatory founder setup (15 min).
  // Failures are kept until the second step passes.
  if (next === "code") {
    await setTicket(String(row.id), Number(row.session_version), AUD_CODE, PENDING_MINUTES);
    return "2fa";
  }
  if (next === "setup") {
    await setTicket(String(row.id), Number(row.session_version), AUD_SETUP, SETUP_MINUTES);
    return "setup";
  }
  await completeLogin(key, { id: String(row.id), name: String(row.name), email: String(row.email), sv: Number(row.session_version) });
  return "ok";
}

async function completeLogin(key: string, u: { id: string; name: string; email: string; sv: number }, extra?: Record<string, unknown>) {
  await db().batch([
    { sql: "DELETE FROM login_attempts WHERE key IN (?, ?)", args: [key, accountKey(u.email)] },
    { sql: "UPDATE admin_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [u.id] },
  ], "write");
  await issueSession(u.id, u.sv);
  await logAction("auth.login", { type: "user", id: u.id }, extra, { id: u.id, name: u.name, email: u.email });
}

/** Who is waiting at the code step (valid, unexpired ticket for an active account with the same session_version), or null. */
async function pendingUser(audience: string = AUD_CODE) {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!authConfigured() || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey()!, { algorithms: ["HS256"], audience });
    if (!payload.sub) return null;
    const u = (await db().execute({ sql: `SELECT id, name, email, session_version FROM admin_users WHERE id = ? AND ${CAN_SIGN_IN_SQL}`, args: [payload.sub] })).rows[0];
    if (!u || Number(u.session_version) !== Number(payload.sv)) return null;
    return { id: String(u.id), name: String(u.name), email: String(u.email), sv: Number(u.session_version), iat: Number(payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export const hasPendingLogin = async () => Boolean(await pendingUser());

export type SecondStepResult = "ok" | "invalid" | "locked" | "expired";

/** Second login step: TOTP or recovery code. Same lockout as the password (per IP + per account), audit on every outcome. */
export async function verifySecondStep(input: string): Promise<SecondStepResult> {
  const u = await pendingUser();
  if (!u) {
    (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" });
    return "expired";
  }
  const actor = { id: u.id, name: u.name, email: u.email };
  if (await secondFactorLocked(u.id)) return "locked";
  const kind = await checkSecondFactor(u.id, input.slice(0, 40)).catch(() => null);
  if (!kind) {
    await recordSecondFactorFailure(u.id);
    await logAction("auth.2fa_failed", { type: "user", id: u.id }, { step: "login" }, actor);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    return "invalid";
  }
  if (kind === "recovery") await logAction("auth.2fa_recovery_used", { type: "user", id: u.id }, undefined, actor);
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" });
  await db().execute({ sql: "DELETE FROM login_attempts WHERE key = ?", args: [`2fa:${u.id}`] });
  await completeLogin(await clientKey(), u, { second_factor: kind });
  return "ok";
}

/* Mandatory founder setup inside the login card: QR, confirm code, recovery codes, then the session. */
export type ForcedSetupStart = { secret: string; qrSvg: string } | "expired";
export async function startForcedSetup(): Promise<ForcedSetupStart> {
  const u = await pendingUser(AUD_SETUP);
  if (!u) return "expired";
  return beginSetup(u.id, u.email);
}

export type ForcedConfirm = { codes: string[] } | "invalid" | "locked" | "expired";
export async function confirmForcedSetup(code: string): Promise<ForcedConfirm> {
  const u = await pendingUser(AUD_SETUP);
  if (!u) return "expired";
  const actor = { id: u.id, name: u.name, email: u.email };
  if (await secondFactorLocked(u.id)) return "locked";
  const codes = await confirmSetup(u.id, code.slice(0, 20)).catch(() => null);
  if (!codes) {
    await recordSecondFactorFailure(u.id);
    await logAction("auth.2fa_failed", { type: "user", id: u.id }, { step: "forced_setup" }, actor);
    return "invalid";
  }
  await logAction("auth.2fa_enabled", { type: "user", id: u.id }, { forced: true }, actor);
  return { codes };
}

/** Last step ("Ho salvato i codici"): only now the full session, and only if 2FA was activated in this same flow. */
export async function finishForcedSetup(): Promise<"ok" | "expired" | "incomplete"> {
  const u = await pendingUser(AUD_SETUP);
  if (!u) return "expired";
  const status = await twoFactorStatus(u.id);
  if (!status.enabled || !forcedSetupFinishable(status.enabledAt, u.iat)) return "incomplete";
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" });
  await db().execute({ sql: "DELETE FROM login_attempts WHERE key = ?", args: [`2fa:${u.id}`] });
  await logAction("auth.2fa_forced_setup", { type: "user", id: u.id }, undefined, { id: u.id, name: u.name, email: u.email });
  await completeLogin(await clientKey(), u, { second_factor: "setup" });
  return "ok";
}

/**
 * Right after an accepted invite (password just set): founders get the 15-minute guided 2FA setup ticket (no session
 * until 2FA is on, same flow as the login card); everyone else gets the session and may set up 2FA now or later.
 */
export async function signInAfterInvite(u: { id: string; name: string; email: string; sv: number; roles: readonly string[] }): Promise<"setup" | "ok"> {
  if (loginNext(u.roles, await twoFactorEnabled(u.id)) === "setup") {
    await setTicket(u.id, u.sv, AUD_SETUP, SETUP_MINUTES);
    return "setup";
  }
  await completeLogin(await clientKey(), u, { via: "invite" });
  return "ok";
}

/** Signs out and revokes the token server-side (session_version bump), so a copied cookie stops working too. Closes the user's other sessions as well. */
export async function logout() {
  const me = await getAdmin().catch(() => null);
  if (me) {
    await logAction("auth.logout", { type: "user", id: me.id }, undefined, me);
    await db()
      .execute({ sql: "UPDATE admin_users SET session_version = session_version + 1 WHERE id = ?", args: [me.id] })
      .catch(() => {});
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Verifies the signed session cookie and re-reads the account on every request (deduped per request):
 * a disabled user, a changed role/area or a password change (session_version bump) takes effect immediately.
 */
const readSession = cache(async (): Promise<{ admin: AdminUser | null; blocked: boolean }> => {
  const none = { admin: null, blocked: false };
  // Read the cookie first so the check is always request-time, never baked into a prerender.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!authConfigured() || !token) return none;
  try {
    const { payload } = await jwtVerify(token, secretKey()!, { algorithms: ["HS256"], audience: "ctrl-admin" });
    if (!payload.sub) return none;
    await ensureTeam();
    await ensureTwoFactorSchema();
    const res = await db().execute({
      sql: `SELECT id, email, name, role, ${ROLES_SQL}, area, email_access, avatar_url IS NOT NULL AS has_avatar, updated_at, session_version,
              EXISTS (SELECT 1 FROM admin_2fa t WHERE t.user_id = admin_users.id AND t.secret_enc IS NOT NULL) AS tfa
            FROM admin_users WHERE id = ? AND ${CAN_SIGN_IN_SQL}`,
      args: [payload.sub],
    });
    const u = res.rows[0];
    if (!u || Number(u.session_version) !== Number(payload.sv)) return none;
    const roles = rowRoles(u);
    // Founder without 2FA (session from before the rule, or after a reset): no admin access until the guided setup.
    if (!sessionAllowed(roles, Number(u.tfa) === 1)) return { admin: null, blocked: true };
    return { blocked: false, admin: {
      id: String(u.id),
      email: String(u.email),
      name: String(u.name),
      roles,
      area: isArea(u.area) ? u.area : null,
      avatarUrl: avatarFor(String(u.id), Number(u.has_avatar) === 1, u.updated_at, String(u.email)),
      emailAccess: isFounder(roles) || Number(u.email_access) === 1,
      issuedAt: Number(payload.iat ?? 0) * 1000,
      expiresAt: Number(payload.exp ?? 0) * 1000,
    } };
  } catch {
    return none;
  }
});

/** Signed-in admin allowed to use the panel, or null. Pages and actions all go through this. */
export const getAdmin = async (): Promise<AdminUser | null> => (await readSession()).admin;

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect((await readSession()).blocked ? "/admin/login/proteggi" : "/admin/login");
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
