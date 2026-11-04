import "server-only";
import { emailSender } from "@/lib/mail/sender";
import { ensureTeam, hashPassword, ROLES_SQL, rowRoles } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { mailProvider } from "@/lib/mail";
import { sendTransactional } from "@/lib/mail/transactional";
import { hashInviteToken, INVITE_TTL_MS, newInviteToken, resendCheck, tokenShapeOk } from "@/lib/team-invite-core";
import { isFounder, ROLE_LABEL, type TeamRole } from "@/lib/team-types";

/*
 * Team invites. The email carries a single-use link (/admin/invito/<token>, 48 hours). Only the SHA-256 of the token
 * is stored; the invited account stays unable to sign in (active = 0, invite_state = 'pending') until the person
 * chooses their own password on that page. No password ever travels by email.
 */

const ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://ctrlagency.dev";
export const inviteUrl = (token: string) => `${ORIGIN}/admin/invito/${token}`;

const list = (roles: readonly TeamRole[]) => {
  const l = roles.map((r) => ROLE_LABEL[r]);
  return l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] ?? "";
};

export function inviteEmail(p: { name: string; roles: TeamRole[]; inviter: string; url: string }) {
  const first = p.name.split(/\s+/)[0] || p.name;
  const text = [
    `Ciao ${first},`,
    `${p.inviter} ti ha invitato a entrare nel team di Ctrl Agency con ${p.roles.length > 1 ? "i ruoli" : "il ruolo"} **${list(p.roles)}**.`,
    "Premi il pulsante qui sotto per scegliere la tua password personale e accedere all'area riservata. Il link vale 48 ore e si può usare una sola volta.",
    `Se preferisci, apri direttamente questo indirizzo: ${p.url}`,
    isFounder(p.roles)
      ? "Come founder, subito dopo ti chiederemo di attivare la verifica in due passaggi con un'app di autenticazione sul telefono."
      : "Dopo la password potrai attivare la verifica in due passaggi, oppure farlo più tardi dalle impostazioni.",
    "Se non aspettavi questo invito puoi ignorare questa email: senza il tuo passaggio l'account resta bloccato.",
  ].join("\n\n");
  return { subject: `${p.inviter} ti ha invitato nel team CTRL®`, text, cta: { label: "Accetta l'invito", href: p.url } };
}

export type InviteResult = { ok: true } | { ok: false; error: string };

/**
 * Sends (or resends) the invite: new token, the previous link stops working. Rate limited per person
 * (2 minutes between emails, 5 per 24 hours). Only for accounts that never accepted (active accounts can't be invited).
 */
export async function sendInvite(userId: string, inviter: { id: string; name: string; roles: TeamRole[]; avatarUrl: string | null }, kind: "sent" | "resent"): Promise<InviteResult> {
  await ensureTeam();
  const provider = mailProvider();
  if (!provider && !process.env.RESEND_API_KEY) return { ok: false, error: "Email dell'agenzia non collegata: impossibile inviare l'invito." };
  const res = await db().execute({
    sql: `SELECT id, name, email, role, ${ROLES_SQL}, active, last_login_at, removed_at, invite_state, invite_sent_at, invite_window_at, invite_window_count FROM admin_users WHERE id = ?`,
    args: [userId],
  });
  const u = res.rows[0];
  if (!u) return { ok: false, error: "Utente non trovato." };
  if (u.removed_at !== null) return { ok: false, error: "Persona rimossa dal team: prima riattivala." };
  // Invitable: open/expired/revoked invites, disabled accounts, or active accounts that never signed in.
  if (Number(u.active) === 1 && u.invite_state === null && u.last_login_at !== null) return { ok: false, error: "Questa persona usa già il suo account." };
  const now = Date.now();
  const gate = resendCheck({
    sentAt: u.invite_sent_at === null ? null : Number(u.invite_sent_at),
    windowAt: u.invite_window_at === null ? null : Number(u.invite_window_at),
    windowCount: Number(u.invite_window_count ?? 0),
  }, now);
  if (!gate.ok) {
    const min = Math.ceil(gate.retryInMs / 60_000);
    return { ok: false, error: min > 60 ? "Troppi inviti a questa persona oggi. Riprova domani." : `Hai appena inviato l'invito. Riprova tra ${min} ${min === 1 ? "minuto" : "minuti"}.` };
  }
  const token = newInviteToken();
  const roles = rowRoles(u);
  // Account blocked until acceptance: active = 0 plus a fresh session_version, so any old session dies too.
  await db().execute({
    sql: `UPDATE admin_users SET invite_state = 'pending', invite_hash = ?, invite_expires_at = ?, invite_sent_at = ?, invite_window_at = ?, invite_window_count = ?,
          invited_by = ?, active = 0, session_version = session_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    args: [hashInviteToken(token), now + INVITE_TTL_MS, now, gate.windowAt, gate.windowCount, inviter.id, userId],
  });
  const mail = inviteEmail({ name: String(u.name), roles, inviter: inviter.name, url: inviteUrl(token) });
  try {
    const { via } = await sendTransactional({ to: [String(u.email)], cc: [], ...mail, sender: emailSender(inviter) }, provider);
    console.info(`[mail] invito inviato via ${via}`);
  } catch {
    return { ok: false, error: "Invio non riuscito. Controlla la connessione dell'email dell'agenzia e riprova tra qualche minuto." };
  }
  await logAction(kind === "sent" ? "team.invite_sent" : "team.invite_resent", { type: "user", id: userId }, { to: String(u.email), roles, expiresAt: new Date(now + INVITE_TTL_MS).toISOString() });
  return { ok: true };
}

/** The link stops working immediately. The account stays blocked until a new invite is accepted. */
export async function revokeInvite(userId: string): Promise<boolean> {
  const res = await db().execute({
    sql: `UPDATE admin_users SET invite_state = 'revoked', invite_hash = NULL, invite_expires_at = NULL, active = 0, session_version = session_version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND invite_state = 'pending'`,
    args: [userId],
  });
  if (res.rowsAffected) await logAction("team.invite_revoked", { type: "user", id: userId });
  return res.rowsAffected > 0;
}

export type InviteView = { state: "valid"; name: string; email: string; roles: TeamRole[] } | { state: "expired" | "invalid" };

/** What the invite page shows for a token (never reveals who an unknown token belongs to). */
export async function readInvite(token: string, now = Date.now()): Promise<InviteView> {
  if (!tokenShapeOk(token)) return { state: "invalid" };
  await ensureTeam();
  const res = await db().execute({
    sql: `SELECT name, email, role, ${ROLES_SQL}, invite_expires_at FROM admin_users WHERE invite_hash = ? AND invite_state = 'pending'`,
    args: [hashInviteToken(token)],
  });
  const u = res.rows[0];
  if (!u) return { state: "invalid" };
  if (Number(u.invite_expires_at) <= now) return { state: "expired" };
  return { state: "valid", name: String(u.name), email: String(u.email), roles: rowRoles(u) };
}

/**
 * Single-use acceptance: one atomic UPDATE that only matches a pending, unexpired token, so a second use (or a race)
 * gets nothing. Sets the password, activates the account and clears the token.
 */
export async function acceptInvite(token: string, password: string, now = Date.now()) {
  if (!tokenShapeOk(token)) return null;
  const hash = await hashPassword(password);
  const res = await db().execute({
    sql: `UPDATE admin_users SET password_hash = ?, active = 1, invite_state = NULL, invite_hash = NULL, invite_expires_at = NULL,
          session_version = session_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE invite_hash = ? AND invite_state = 'pending' AND invite_expires_at > ?
          RETURNING id, name, email, role, session_version`,
    args: [hash, hashInviteToken(token), now],
  });
  const u = res.rows[0];
  if (!u) return null;
  const rolesRes = await db().execute({ sql: "SELECT GROUP_CONCAT(role) AS roles FROM admin_user_roles WHERE user_id = ?", args: [String(u.id)] });
  const user = { id: String(u.id), name: String(u.name), email: String(u.email), sv: Number(u.session_version), roles: rowRoles({ role: u.role, roles: rolesRes.rows[0]?.roles }) };
  await logAction("team.invite_accepted", { type: "user", id: user.id }, { roles: user.roles }, { id: user.id, name: user.name, email: user.email });
  return user;
}
