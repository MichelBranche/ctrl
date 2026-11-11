import "server-only";
import { ROLES_SQL, rowRoles } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { isFounder } from "@/lib/team-types";

/*
 * "Rimuovi dal team" (offboarding) as a soft delete. The admin_users row, name and email stay, so audit log,
 * introiti, email claims, desk items and content keep showing who did what. The person loses access immediately:
 * removed_at/removed_by set, active = 0, password made unusable, session_version bumped (every session dies),
 * pending invite revoked, 2FA secret and recovery codes deleted. Roles are kept (they grant nothing while removed)
 * so "Riattiva" restores the same profile. Founders can never be removed: checked here and again in the SQL.
 */

const NOT_FOUNDER_SQL = "role <> 'founder' AND NOT EXISTS (SELECT 1 FROM admin_user_roles r WHERE r.user_id = admin_users.id AND r.role = 'founder')";

export async function removeMember(id: string, actorId: string): Promise<"ok" | "founder" | "self" | "notfound"> {
  if (id === actorId) return "self";
  const res = await db().execute({ sql: `SELECT id, name, email, role, ${ROLES_SQL} FROM admin_users WHERE id = ? AND removed_at IS NULL`, args: [id] });
  const u = res.rows[0];
  if (!u) return "notfound";
  if (isFounder(rowRoles(u))) return "founder";
  const [upd] = await db().batch([
    {
      sql: `UPDATE admin_users SET removed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), removed_by = ?, active = 0, email_access = 0, password_hash = ?,
            invite_state = NULL, invite_hash = NULL, invite_expires_at = NULL, session_version = session_version + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ? AND removed_at IS NULL AND ${NOT_FOUNDER_SQL}`,
      // Not a valid scrypt string: verifyPassword always returns false.
      args: [actorId, `removed$${crypto.randomUUID()}`, id],
    },
    { sql: "DELETE FROM admin_2fa_recovery WHERE user_id = ? AND EXISTS (SELECT 1 FROM admin_users WHERE id = ? AND removed_at IS NOT NULL)", args: [id, id] },
    { sql: "DELETE FROM admin_2fa WHERE user_id = ? AND EXISTS (SELECT 1 FROM admin_users WHERE id = ? AND removed_at IS NOT NULL)", args: [id, id] },
  ], "write");
  if (!upd.rowsAffected) return "founder";
  await logAction("team.user_removed", { type: "user", id }, { name: String(u.name), roles: rowRoles(u) });
  return "ok";
}

/** Back in the team list as "Disattivato" (no password): the founder then sends an invite to pick a new password. */
export async function reactivateMember(id: string): Promise<boolean> {
  const res = await db().execute({
    sql: "UPDATE admin_users SET removed_at = NULL, removed_by = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND removed_at IS NOT NULL",
    args: [id],
  });
  if (res.rowsAffected) await logAction("team.user_reactivated", { type: "user", id });
  return res.rowsAffected > 0;
}
