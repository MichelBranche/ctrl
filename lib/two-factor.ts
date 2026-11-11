import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { ensureTwoFactorSchema } from "@/lib/migrate";
import {
  base32Encode, decryptSecret, deriveKey, encryptSecret, hashRecovery, newRecoveryCodes, newSecret,
  normalizeRecovery, otpauthUri, sameHash, verifyTotp,
} from "@/lib/totp-core";

/*
 * Optional per-user TOTP 2FA (db/010_two_factor.sql). No external service: codes come from any authenticator app,
 * the QR is drawn locally as SVG. Secret: AES-256-GCM with an HKDF(SESSION_SECRET, "ctrl-totp-v1") key.
 * Recovery codes: HMAC-SHA256 with HKDF(SESSION_SECRET, "ctrl-2fa-recovery-v1"), single use.
 * Both keys derive from SESSION_SECRET: rotating it makes every enrolled secret and recovery code unreadable,
 * so before a rotation each user disables 2FA (or a founder resets it from Team) and enables it again afterwards.
 */
const SETUP_TTL_MS = 15 * 60_000;
const master = () => {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET missing");
  return s;
};
const totpKey = () => deriveKey(master(), "ctrl-totp-v1");
const recoveryKey = () => deriveKey(master(), "ctrl-2fa-recovery-v1");
const aad = (userId: string) => `admin_2fa:${userId}`;

export type TwoFactorStatus = { enabled: boolean; enabledAt: string | null; recoveryLeft: number };

export async function twoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  await ensureTwoFactorSchema();
  const [row, rec] = await Promise.all([
    db().execute({ sql: "SELECT secret_enc, enabled_at FROM admin_2fa WHERE user_id = ?", args: [userId] }),
    db().execute({ sql: "SELECT COUNT(*) AS n FROM admin_2fa_recovery WHERE user_id = ? AND used_at IS NULL", args: [userId] }),
  ]);
  const enabled = Boolean(row.rows[0]?.secret_enc);
  return { enabled, enabledAt: enabled ? String(row.rows[0]?.enabled_at ?? "") || null : null, recoveryLeft: enabled ? Number(rec.rows[0]?.n ?? 0) : 0 };
}

export const twoFactorEnabled = async (userId: string) => (await twoFactorStatus(userId)).enabled;

/** Step 1: a fresh secret kept as "pending" until confirmed. Shown as QR (local SVG) + manual key. */
export async function beginSetup(userId: string, account: string) {
  await ensureTwoFactorSchema();
  const secret = newSecret();
  await db().execute({
    sql: `INSERT INTO admin_2fa (user_id, pending_enc, pending_at) VALUES (?1, ?2, ?3)
          ON CONFLICT(user_id) DO UPDATE SET pending_enc = ?2, pending_at = ?3`,
    args: [userId, encryptSecret(totpKey(), secret, aad(userId)), Date.now()],
  });
  const b32 = base32Encode(secret);
  const uri = otpauthUri(b32, account);
  const qrSvg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  return { secret: b32.replace(/(.{4})/g, "$1 ").trim(), qrSvg };
}

/** Step 2: the first valid code activates 2FA and returns 10 recovery codes (shown once, stored as hashes). */
export async function confirmSetup(userId: string, code: string): Promise<string[] | null> {
  await ensureTwoFactorSchema();
  const row = (await db().execute({ sql: "SELECT pending_enc, pending_at FROM admin_2fa WHERE user_id = ?", args: [userId] })).rows[0];
  if (!row?.pending_enc || Date.now() - Number(row.pending_at ?? 0) > SETUP_TTL_MS) return null;
  const secret = decryptSecret(totpKey(), String(row.pending_enc), aad(userId));
  const step = verifyTotp(secret, code, Date.now(), 0);
  if (step === null) return null;
  const codes = newRecoveryCodes();
  const key = recoveryKey();
  await db().batch([
    { sql: `UPDATE admin_2fa SET secret_enc = pending_enc, pending_enc = NULL, pending_at = NULL, last_step = ?,
            enabled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`, args: [step, userId] },
    { sql: "DELETE FROM admin_2fa_recovery WHERE user_id = ?", args: [userId] },
    ...codes.map((c) => ({ sql: "INSERT INTO admin_2fa_recovery (user_id, code_hash) VALUES (?, ?)", args: [userId, hashRecovery(key, userId, c)] })),
  ], "write");
  return codes;
}

export type SecondFactor = "totp" | "recovery" | null;

/**
 * Checks a 6-digit code (±1 step, never a step already used: the UPDATE only succeeds while last_step < step, so two
 * concurrent requests cannot both accept it) or a recovery code (marked used atomically).
 */
export async function checkSecondFactor(userId: string, input: string): Promise<SecondFactor> {
  await ensureTwoFactorSchema();
  const row = (await db().execute({ sql: "SELECT secret_enc, last_step FROM admin_2fa WHERE user_id = ?", args: [userId] })).rows[0];
  if (!row?.secret_enc) return null;
  const digits = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(digits)) {
    const secret = decryptSecret(totpKey(), String(row.secret_enc), aad(userId));
    const step = verifyTotp(secret, digits, Date.now(), Number(row.last_step ?? 0));
    if (step === null) return null;
    const res = await db().execute({ sql: "UPDATE admin_2fa SET last_step = ?1 WHERE user_id = ?2 AND last_step < ?1 RETURNING user_id", args: [step, userId] });
    return res.rows.length ? "totp" : null;
  }
  if (normalizeRecovery(input).length !== 12) return null;
  const want = hashRecovery(recoveryKey(), userId, input);
  const rows = (await db().execute({ sql: "SELECT id, code_hash FROM admin_2fa_recovery WHERE user_id = ? AND used_at IS NULL", args: [userId] })).rows;
  let id: number | null = null;
  for (const r of rows) if (sameHash(String(r.code_hash), want) && id === null) id = Number(r.id);
  if (id === null) return null;
  const res = await db().execute({
    sql: "UPDATE admin_2fa_recovery SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND used_at IS NULL RETURNING id",
    args: [id],
  });
  return res.rows.length ? "recovery" : null;
}

/** Removes the secret and all recovery codes. Callers verify password + code first (or are a founder resetting a member). */
export async function removeTwoFactor(userId: string) {
  await ensureTwoFactorSchema();
  await db().batch([
    { sql: "DELETE FROM admin_2fa WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM admin_2fa_recovery WHERE user_id = ?", args: [userId] },
  ], "write");
}
