/*
 * Team invite rules, pure (no DB, no cookies) so scripts/team-invite-test.mjs can test them directly.
 * Token: 32 random bytes (base64url) sent only in the email link; the DB keeps only its SHA-256.
 */
import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 48 * 3600_000;
/** Resend limits per invited person: at most one email every 2 minutes and 5 in 24 hours. */
export const RESEND_GAP_MS = 2 * 60_000;
export const RESEND_WINDOW_MS = 24 * 3600_000;
export const RESEND_MAX = 5;

export const newInviteToken = () => randomBytes(32).toString("base64url");
export const hashInviteToken = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");
/** Shape check before touching the DB (43 base64url chars). */
export const tokenShapeOk = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export type InviteStatus = "attivo" | "invitato" | "scaduto" | "revocato" | "disattivato" | "rimosso";
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  attivo: "Attivo",
  invitato: "Invitato",
  scaduto: "Invito scaduto",
  revocato: "Invito revocato",
  disattivato: "Disattivato",
  rimosso: "Rimosso dal team",
};

export function inviteStatus(u: { active: boolean; inviteState: string | null; inviteExpiresAt: number | null }, now = Date.now()): InviteStatus {
  if (u.inviteState === "pending") return u.inviteExpiresAt !== null && u.inviteExpiresAt > now ? "invitato" : "scaduto";
  if (u.inviteState === "revoked") return "revocato";
  return u.active ? "attivo" : "disattivato";
}

/** Whether another invite email may go out now, and the counters to store if it does. */
export function resendCheck(s: { sentAt: number | null; windowAt: number | null; windowCount: number }, now = Date.now()):
  { ok: true; windowAt: number; windowCount: number } | { ok: false; retryInMs: number } {
  if (s.sentAt !== null && now - s.sentAt < RESEND_GAP_MS) return { ok: false, retryInMs: RESEND_GAP_MS - (now - s.sentAt) };
  const fresh = s.windowAt === null || now - s.windowAt >= RESEND_WINDOW_MS;
  const windowAt = fresh ? now : (s.windowAt as number);
  const count = fresh ? 0 : s.windowCount;
  if (count >= RESEND_MAX) return { ok: false, retryInMs: windowAt + RESEND_WINDOW_MS - now };
  return { ok: true, windowAt, windowCount: count + 1 };
}
