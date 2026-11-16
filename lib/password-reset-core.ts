/*
 * "Password dimenticata?" rules, pure (no DB, no cookies) so scripts/password-reset-test.mjs can test them directly.
 * Token: 32 random bytes (base64url) sent only in the email link; the DB keeps only its SHA-256.
 */
import { createHash, randomBytes } from "node:crypto";

export const RESET_TTL_MS = 30 * 60_000;
/** Request limits: 3 emails per hour per account (counted for unknown addresses too), 10 per hour per IP. */
export const RESET_WINDOW_MS = 60 * 60_000;
export const RESET_MAX_PER_ACCOUNT = 3;
export const RESET_MAX_PER_IP = 10;
/** Every request answers after at least this long (plus jitter), known address or not. */
export const RESET_MIN_RESPONSE_MS = 900;

export const newResetToken = () => randomBytes(32).toString("base64url");
export const hashResetToken = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");
/** Shape check before touching the DB (43 base64url chars). */
export const resetTokenShapeOk = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
export const resetPath = (token: string) => `/admin/login/reimposta?token=${encodeURIComponent(token)}`;
export const emailShapeOk = (email: string) => email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
