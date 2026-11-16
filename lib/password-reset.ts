import "server-only";
import { after } from "next/server";
import { accountKey, authConfigured, CAN_SIGN_IN_SQL, clientKey, ensureTeam, hashPassword, isLocked, recordFailure } from "@/lib/admin";
import { adminDict, interpolate, type AdminLocale } from "@/lib/admin-i18n";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { mailProvider } from "@/lib/mail";
import { PUBLIC_ORIGIN } from "@/lib/mail/sender";
import { sendTransactional } from "@/lib/mail/transactional";
import { ensurePasswordResetSchema } from "@/lib/migrate";
import {
  emailShapeOk, hashResetToken, newResetToken, RESET_MAX_PER_ACCOUNT, RESET_MAX_PER_IP, RESET_MIN_RESPONSE_MS,
  RESET_TTL_MS, RESET_WINDOW_MS, resetPath, resetTokenShapeOk,
} from "@/lib/password-reset-core";

/*
 * "Password dimenticata?". The request always gets the same answer after the same minimum time, whether or not the
 * address has an account (no enumeration); only accounts that can sign in get an email. The link carries a 32-byte
 * token, the DB keeps its SHA-256 only; 30 minutes, single use, a new request deletes the older unused links.
 * Resetting signs out every session (session_version + 1) and never signs in: 2FA still applies on the next login.
 */

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function resetEmail(lang: AdminLocale, p: { name: string; url: string }) {
  const t = adminDict[lang].reset;
  const text = [interpolate(t.emailHello, { name: first(p.name) }), t.emailIntro, t.emailAction, interpolate(t.emailUrl, { url: p.url }), t.emailIgnore].join("\n\n");
  return { subject: t.emailSubject, text, cta: { label: t.emailCta, href: p.url } };
}

export function resetDoneEmail(lang: AdminLocale, p: { name: string }) {
  const t = adminDict[lang].reset;
  const text = [interpolate(t.emailHello, { name: first(p.name) }), t.changedBody, t.changedWarn].join("\n\n");
  return { subject: t.changedSubject, text, cta: { label: t.changedCta, href: `${PUBLIC_ORIGIN}/admin/login` } };
}

/** Sends after the response, so delivery time never shows in the request timing. Errors are logged without details. */
function sendLater(to: string, mail: { subject: string; text: string; cta: { label: string; href: string } }, label: string) {
  after(async () => {
    try {
      const { via } = await sendTransactional({ to: [to], cc: [], ...mail, sender: null }, mailProvider());
      console.info(`[mail] ${label} inviata via ${via}`);
    } catch {
      console.warn(`[mail] ${label}: invio non riuscito`);
    }
  });
}

const pad = async (started: number) => {
  const wait = RESET_MIN_RESPONSE_MS + Math.random() * 250 - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
};

/** Always resolves the same way. Rate limit: per account key (hash of the typed email) and per IP, counted on every request. */
export async function requestPasswordReset(rawEmail: string, lang: AdminLocale, now = () => Date.now()): Promise<void> {
  const started = Date.now();
  try {
    const email = rawEmail.trim().toLowerCase().slice(0, 200);
    if (!authConfigured() || !emailShapeOk(email)) return;
    await ensureTeam();
    await ensurePasswordResetSchema();
    const ipKey = `reset:${await clientKey()}`;
    const acctKey = `reset:${accountKey(email)}`;
    if ((await isLocked(ipKey)) || (await isLocked(acctKey))) return;
    await recordFailure(ipKey, RESET_MAX_PER_IP, RESET_WINDOW_MS, RESET_WINDOW_MS);
    await recordFailure(acctKey, RESET_MAX_PER_ACCOUNT, RESET_WINDOW_MS, RESET_WINDOW_MS);
    const u = (await db().execute({ sql: `SELECT id, name, email FROM admin_users WHERE email = ? AND ${CAN_SIGN_IN_SQL}`, args: [email] })).rows[0];
    if (!u) return;
    const id = String(u.id);
    const token = newResetToken();
    const at = now();
    await db().batch([
      { sql: "DELETE FROM admin_password_resets WHERE (user_id = ? AND used_at IS NULL) OR created_at < ?", args: [id, at - 7 * 86_400_000] },
      { sql: "INSERT INTO admin_password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", args: [hashResetToken(token), id, at, at + RESET_TTL_MS] },
    ], "write");
    await logAction("auth.password_reset_requested", { type: "user", id }, { expiresAt: new Date(at + RESET_TTL_MS).toISOString(), lang }, null);
    sendLater(String(u.email), resetEmail(lang, { name: String(u.name), url: PUBLIC_ORIGIN + resetPath(token) }), "email di reimpostazione password");
  } catch {
    console.warn("[auth] richiesta di reimpostazione non completata");
  } finally {
    await pad(started);
  }
}

export type ResetView = "valid" | "expired" | "invalid";

/** What the reset page shows for a token. Never says whose it is. */
export async function readReset(token: unknown, now = Date.now()): Promise<ResetView> {
  if (!resetTokenShapeOk(token) || !authConfigured()) return "invalid";
  await ensurePasswordResetSchema();
  const r = (await db().execute({
    sql: `SELECT expires_at, used_at FROM admin_password_resets WHERE token_hash = ? AND user_id IN (SELECT id FROM admin_users WHERE ${CAN_SIGN_IN_SQL})`,
    args: [hashResetToken(token)],
  })).rows[0];
  if (!r || r.used_at !== null) return "invalid";
  return Number(r.expires_at) > now ? "valid" : "expired";
}

/**
 * Single use: one atomic UPDATE claims an unused, unexpired token, so a second use (or a race) gets nothing.
 * Then new hash + session_version bump (every session and pending 2FA ticket dies), lockouts for the account cleared.
 */
export async function resetPassword(token: unknown, password: string, lang: AdminLocale, now = Date.now()): Promise<"ok" | "invalid"> {
  if (!resetTokenShapeOk(token) || !authConfigured()) return "invalid";
  await ensurePasswordResetSchema();
  const hash = await hashPassword(password);
  const claim = (await db().execute({
    sql: "UPDATE admin_password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id",
    args: [now, hashResetToken(token), now],
  })).rows[0];
  if (!claim) return "invalid";
  const u = (await db().execute({
    sql: `UPDATE admin_users SET password_hash = ?, session_version = session_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ? AND ${CAN_SIGN_IN_SQL} RETURNING id, name, email`,
    args: [hash, String(claim.user_id)],
  })).rows[0];
  if (!u) return "invalid";
  const user = { id: String(u.id), name: String(u.name), email: String(u.email) };
  await db().batch([
    { sql: "DELETE FROM login_attempts WHERE key IN (?, ?)", args: [accountKey(user.email), `2fa:${user.id}`] },
    { sql: "DELETE FROM admin_password_resets WHERE user_id = ? AND used_at IS NULL", args: [user.id] },
  ], "write");
  await logAction("auth.password_reset", { type: "user", id: user.id }, undefined, user);
  sendLater(user.email, resetDoneEmail(lang, user), "avviso di password cambiata");
  return "ok";
}
