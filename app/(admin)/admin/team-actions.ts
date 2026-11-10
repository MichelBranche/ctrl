"use server";

import { emailSender } from "@/lib/mail/sender";
import { removeTwoFactor } from "@/lib/two-factor";
import { revalidatePath } from "next/cache";
import { ensureTeam, guardSection, hashPassword, passwordOk } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { writeSettings } from "@/lib/settings";
import { LEADERBOARD_KEY } from "@/lib/team";
import { mailProvider } from "@/lib/mail";
import { reactivateMember, removeMember } from "@/lib/team-delete";
import { OFFBOARDING_SUBJECT } from "@/lib/team-offboarding";
import { sendTransactional } from "@/lib/mail/transactional";
import { sendInvite, revokeInvite } from "@/lib/team-invite";
import { isArea, isFounder, legacyTier, normalizeRoles, type TeamRole } from "@/lib/team-types";

/* Every action re-checks the session and permissions server-side; the UI hiding a button is never the check. */

export type TeamState = { ok?: string; error?: string };

const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID = /^[\w-]{1,64}$/;

/** "1.234,50", "1234.5", "€ 80" → cents. Null when not a positive amount up to 10M €. */
function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= 1_000_000_000 ? cents : null;
}

function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function refresh() {
  revalidatePath("/admin/introiti");
  revalidatePath("/admin/team");
}

/** Members log their own jobs; a founder may log one for anyone. */
export async function addJob(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("introiti");
  await ensureTeam();
  const target = isFounder(me) ? str(form, "user", 64) || me.id : me.id;
  const client = str(form, "client", 120);
  const description = str(form, "description", 500);
  const cents = parseAmount(str(form, "amount", 32));
  const date = str(form, "date", 10);
  const area = str(form, "area", 32);
  if (!client) return { error: "Indica il cliente." };
  if (!description) return { error: "Descrivi il lavoro." };
  if (cents === null) return { error: "Importo non valido (es. 1.250,00)." };
  if (!validDate(date)) return { error: "Data non valida." };
  if (!isArea(area)) return { error: "Scegli un'area." };
  if (target !== me.id) {
    const exists = await db().execute({ sql: "SELECT 1 FROM admin_users WHERE id = ?", args: [target] });
    if (!exists.rows.length) return { error: "Utente non trovato." };
  }
  await db().execute({
    sql: "INSERT INTO team_jobs (id, user_id, client, description, amount_cents, date, area, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [crypto.randomUUID(), target, client, description, cents, date, area, me.id],
  });
  await logAction("introiti.job_add", { type: "user", id: target }, { cents, date, area });
  refresh();
  return { ok: "Lavoro registrato." };
}

/** Owner or founder only. */
export async function deleteJob(id: string): Promise<{ ok: boolean }> {
  const me = await guardSection("introiti");
  if (!ID.test(id)) return { ok: false };
  const res = await db().execute(
    isFounder(me)
      ? { sql: "DELETE FROM team_jobs WHERE id = ?", args: [id] }
      : { sql: "DELETE FROM team_jobs WHERE id = ? AND user_id = ?", args: [id, me.id] },
  );
  if (res.rowsAffected) await logAction("introiti.job_delete", { type: "job", id });
  refresh();
  return { ok: res.rowsAffected > 0 };
}

const formRoles = (form: FormData) => normalizeRoles(form.getAll("roles").map(String));

/** Replaces the person's roles (source of truth) and keeps the legacy founder/member column in sync. */
const roleWrites = (id: string, roles: TeamRole[]) => [
  { sql: "DELETE FROM admin_user_roles WHERE user_id = ?", args: [id] },
  ...roles.map((r) => ({ sql: "INSERT INTO admin_user_roles (user_id, role) VALUES (?, ?)", args: [id, r] })),
];

/**
 * New team member. Default mode "invite": the account is created blocked and an email invite goes out, the person picks
 * their own password. Mode "password" (fallback without agency email): the founder sets a password to hand over in person.
 */
export async function createUser(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("team");
  await ensureTeam();
  const name = str(form, "name", 80);
  const lastName = str(form, "last_name", 80) || null;
  const email = str(form, "email", 200).toLowerCase();
  const roles = formRoles(form);
  const area = str(form, "area", 32);
  const mode = form.get("mode") === "password" ? "password" : "invite";
  const password = String(form.get("password") ?? "");
  const emailAccess = form.get("email_access") === "on";
  if (!name) return { error: "Indica il nome." };
  if (!EMAIL.test(email)) return { error: "Email non valida." };
  if (!roles.length) return { error: "Scegli almeno un ruolo." };
  if (area && !isArea(area)) return { error: "Area non valida." };
  if (mode === "password" && !passwordOk(password)) return { error: "La password deve avere almeno 12 caratteri." };
  const id = crypto.randomUUID();
  const exists = await db().execute({ sql: "SELECT 1 FROM admin_users WHERE email = ?", args: [email] });
  if (exists.rows.length) return { error: "Esiste già un utente con questa email." };
  // Invite mode: random unusable password hash and active = 0 + invite_state 'pending' (set by sendInvite) until accepted.
  const hash = await hashPassword(mode === "password" ? password : crypto.randomUUID() + crypto.randomUUID());
  await db().batch([
    {
      sql: `INSERT INTO admin_users (id, email, name, last_name, role, area, password_hash, email_access, active, invite_state, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, email, name, lastName, legacyTier(roles), isArea(area) ? area : null, hash, emailAccess ? 1 : 0, mode === "password" ? 1 : 0, mode === "password" ? null : "pending", mode === "password" ? null : me.id],
    },
    ...roleWrites(id, roles),
  ], "write");
  await logAction("team.user_create", { type: "user", id: email }, { roles, area: isArea(area) ? area : null, emailAccess, mode });
  refresh();
  if (mode === "password") return { ok: `Profilo creato per ${name}. Comunicagli la password di persona.` };
  const sent = await sendInvite(id, me, "sent");
  if (!sent.ok) return { error: `Profilo creato ma invito non inviato: ${sent.error} Puoi riprovare con "Reinvia invito".` };
  return { ok: `Invito inviato a ${email}. Il link vale 48 ore.` };
}

/** Name, roles, area and flags. A founder can't remove their own founder role or disable themselves; always one active founder. */
export async function updateUser(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("team");
  const id = str(form, "id", 64);
  const name = str(form, "name", 80);
  const lastName = str(form, "last_name", 80) || null;
  const roles = formRoles(form);
  const area = str(form, "area", 32);
  const active = form.get("active") === "on";
  const emailAccess = form.get("email_access") === "on";
  if (!ID.test(id) || !name) return { error: "Dati non validi." };
  if (!roles.length) return { error: "Scegli almeno un ruolo." };
  if (area && !isArea(area)) return { error: "Area non valida." };
  const founder = isFounder(roles);
  if (id === me.id && (!founder || !active)) return { error: "Non puoi togliere a te stesso il ruolo founder o disattivarti." };
  const tier = legacyTier(roles);
  // Guard in SQL: the update only applies if this user stays an active founder or another active founder exists.
  // An open invite keeps the account blocked: "active" can only be switched on after acceptance.
  const [res] = await db().batch([
    {
      sql: `UPDATE admin_users SET name = ?, last_name = ?, role = ?, area = ?, active = CASE WHEN invite_state IS NULL THEN ? ELSE 0 END, email_access = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ? AND (? = 'founder' AND ? = 1 OR (SELECT COUNT(*) FROM admin_users WHERE role = 'founder' AND active = 1 AND invite_state IS NULL AND id <> ?) > 0)`,
      args: [name, lastName, tier, isArea(area) ? area : null, active ? 1 : 0, emailAccess ? 1 : 0, id, tier, active ? 1 : 0, id],
    },
  ], "write");
  if (!res.rowsAffected) return { error: "Serve sempre almeno un founder attivo." };
  await db().batch(roleWrites(id, roles), "write");
  await logAction("team.user_update", { type: "user", id }, { roles, area: isArea(area) ? area : null, active, emailAccess });
  refresh();
  return { ok: "Profilo aggiornato." };
}

/** Invite (or re-invite) a person who has not accepted yet. Rate limited in sendInvite. */
export async function resendUserInvite(id: string): Promise<TeamState> {
  const me = await guardSection("team");
  if (!ID.test(id) || id === me.id) return { error: "Utente non valido." };
  const exists = await db().execute({ sql: "SELECT invite_state, invite_sent_at FROM admin_users WHERE id = ?", args: [id] });
  const first = exists.rows[0] && exists.rows[0].invite_sent_at === null;
  const r = await sendInvite(id, me, first ? "sent" : "resent");
  refresh();
  return r.ok ? { ok: "Invito inviato. Il nuovo link vale 48 ore, quello precedente non funziona più." } : { error: r.error };
}

export async function revokeUserInvite(id: string): Promise<TeamState> {
  await guardSection("team");
  if (!ID.test(id)) return { error: "Utente non valido." };
  const ok = await revokeInvite(id);
  refresh();
  return ok ? { ok: "Invito revocato. Il link non funziona più." } : { error: "Nessun invito aperto per questa persona." };
}

/** Sets a new password and signs the user out everywhere. */
export async function resetUserPassword(_: TeamState, form: FormData): Promise<TeamState> {
  await guardSection("team");
  const id = str(form, "id", 64);
  const password = String(form.get("password") ?? "");
  if (!ID.test(id)) return { error: "Utente non valido." };
  if (!passwordOk(password)) return { error: "La password deve avere almeno 12 caratteri." };
  const res = await db().execute({
    sql: "UPDATE admin_users SET password_hash = ?, session_version = session_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    args: [await hashPassword(password), id],
  });
  if (!res.rowsAffected) return { error: "Utente non trovato." };
  await logAction("team.password_reset", { type: "user", id });
  return { ok: "Password reimpostata: le sue sessioni aperte sono state chiuse." };
}

export async function setLeaderboardVisible(visible: boolean): Promise<{ ok: boolean }> {
  await guardSection("team");
  await writeSettings({ [LEADERBOARD_KEY]: visible ? "1" : "" });
  await logAction("team.leaderboard", undefined, { visible });
  refresh();
  return { ok: true };
}

/** Founder rescue when a member lost phone and recovery codes: removes their 2FA and closes their sessions. */
export async function resetUserTwoFactor(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("team");
  const id = str(form, "id", 64);
  if (!ID.test(id) || id === me.id) return { error: "Utente non valido." };
  await removeTwoFactor(id);
  await db().execute({ sql: "UPDATE admin_users SET session_version = session_version + 1 WHERE id = ?", args: [id] });
  await logAction("auth.2fa_disabled", { type: "user", id }, { by: "founder_reset" });
  return { ok: "Verifica in due passaggi azzerata." };
}

/** "Rimuovi dal team". Founder only; never a founder (enforced in removeMember); the typed name must match. */
export async function removeUser(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("team");
  const id = str(form, "id", 64);
  const typed = str(form, "confirm", 80);
  if (!ID.test(id)) return { error: "Utente non valido." };
  const notify = form.get("notify") === "on";
  const text = String(form.get("notify_text") ?? "").trim().slice(0, 5000);
  if (notify && text.length < 20) return { error: "Scrivi il testo dell'email di cessazione o togli la spunta." };
  const row = await db().execute({ sql: "SELECT name, email FROM admin_users WHERE id = ? AND removed_at IS NULL", args: [id] });
  if (!row.rows.length) return { error: "Utente non trovato." };
  if (typed !== String(row.rows[0].name)) return { error: "Scrivi il nome esatto per confermare." };
  const r = await removeMember(id, me.id);
  if (r === "founder") return { error: "I founder non si possono rimuovere dal team." };
  if (r === "self") return { error: "Non puoi rimuovere te stesso." };
  if (r === "notfound") return { error: "Utente non trovato." };
  refresh();
  if (!notify) return { ok: "Rimosso dal team (nessuna email inviata). Lo trovi in Ex membri con tutto il suo storico." };
  // Access is already revoked; a failed email does not undo the removal.
  const provider = mailProvider();
  const to = String(row.rows[0].email);
  try {
    await sendTransactional({ to: [to], cc: [], subject: OFFBOARDING_SUBJECT, text, sender: emailSender(me) }, provider);
  } catch {
    await logAction("team.offboarding_email_failed", { type: "user", id }, { to });
    return { error: "Rimosso dal team, ma l'email di cessazione non è partita. Puoi scrivergli dalla casella Email." };
  }
  await logAction("team.offboarding_email", { type: "user", id }, { to, edited: text.length });
  return { ok: "Rimosso dal team ed email di cessazione inviata. Lo trovi in Ex membri." };
}

export async function reactivateUser(id: string): Promise<TeamState> {
  await guardSection("team");
  if (!ID.test(id)) return { error: "Utente non valido." };
  const ok = await reactivateMember(id);
  refresh();
  return ok ? { ok: "Riattivato. Invialo nel team per fargli scegliere una nuova password." } : { error: "Utente non trovato." };
}
