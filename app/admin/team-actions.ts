"use server";

import { revalidatePath } from "next/cache";
import { ensureTeam, guardSection, hashPassword, passwordOk } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { writeSettings } from "@/lib/settings";
import { LEADERBOARD_KEY } from "@/lib/team";
import { isArea, isRole } from "@/lib/team-types";

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
  const target = me.role === "founder" ? str(form, "user", 64) || me.id : me.id;
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
    me.role === "founder"
      ? { sql: "DELETE FROM team_jobs WHERE id = ?", args: [id] }
      : { sql: "DELETE FROM team_jobs WHERE id = ? AND user_id = ?", args: [id, me.id] },
  );
  if (res.rowsAffected) await logAction("introiti.job_delete", { type: "job", id });
  refresh();
  return { ok: res.rowsAffected > 0 };
}

export async function createUser(_: TeamState, form: FormData): Promise<TeamState> {
  await guardSection("team");
  await ensureTeam();
  const name = str(form, "name", 80);
  const email = str(form, "email", 200).toLowerCase();
  const role = str(form, "role", 16);
  const area = str(form, "area", 32);
  const password = String(form.get("password") ?? "");
  const emailAccess = form.get("email_access") === "on";
  if (!name) return { error: "Indica il nome." };
  if (!EMAIL.test(email)) return { error: "Email non valida." };
  if (!isRole(role)) return { error: "Ruolo non valido." };
  if (role === "member" && !isArea(area)) return { error: "Un membro deve avere un'area." };
  if (!passwordOk(password)) return { error: "La password deve avere almeno 12 caratteri." };
  const res = await db().execute({
    sql: "INSERT OR IGNORE INTO admin_users (id, email, name, role, area, password_hash, email_access) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [crypto.randomUUID(), email, name, role, isArea(area) ? area : null, await hashPassword(password), emailAccess ? 1 : 0],
  });
  if (!res.rowsAffected) return { error: "Esiste già un utente con questa email." };
  await logAction("team.user_create", { type: "user", id: email }, { role, area: isArea(area) ? area : null, emailAccess });
  refresh();
  return { ok: `Profilo creato per ${name}. Comunicagli la password di persona.` };
}

/** Role, area and active flag. A founder can't demote or disable themselves, and there is always one active founder. */
export async function updateUser(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await guardSection("team");
  const id = str(form, "id", 64);
  const name = str(form, "name", 80);
  const role = str(form, "role", 16);
  const area = str(form, "area", 32);
  const active = form.get("active") === "on";
  const emailAccess = form.get("email_access") === "on";
  if (!ID.test(id) || !name || !isRole(role)) return { error: "Dati non validi." };
  if (role === "member" && !isArea(area)) return { error: "Un membro deve avere un'area." };
  if (id === me.id && (role !== "founder" || !active)) return { error: "Non puoi togliere a te stesso il ruolo founder o disattivarti." };
  const res = await db().execute({
    sql: `UPDATE admin_users SET name = ?, role = ?, area = ?, active = ?, email_access = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ? AND (? = 'founder' AND ? = 1 OR (SELECT COUNT(*) FROM admin_users WHERE role = 'founder' AND active = 1 AND id <> ?) > 0)`,
    args: [name, role, isArea(area) ? area : null, active ? 1 : 0, emailAccess ? 1 : 0, id, role, active ? 1 : 0, id],
  });
  if (!res.rowsAffected) return { error: "Serve sempre almeno un founder attivo." };
  await logAction("team.user_update", { type: "user", id }, { role, area: isArea(area) ? area : null, active, emailAccess });
  refresh();
  return { ok: "Profilo aggiornato." };
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
