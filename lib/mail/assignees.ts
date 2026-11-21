import "server-only";
import { CAN_SIGN_IN_SQL } from "@/lib/admin";
import { avatarFor } from "@/lib/avatars";
import { db } from "@/lib/db";
import type { MailboxId } from "@/lib/mail/mailbox-types";
import { isFounder } from "@/lib/team-types";

export type Assignee = { id: string; name: string; avatarUrl: string | null };

/** People a message of this mailbox can be assigned to: founders always; hello@ also anyone with the Email permission. */
export async function assignableUsers(box: MailboxId): Promise<Assignee[]> {
  const rows = (await db().execute(`SELECT u.id, u.email, u.name, u.last_name, u.email_access, u.avatar_url IS NOT NULL AS has_avatar, u.updated_at,
      (SELECT GROUP_CONCAT(r.role) FROM admin_user_roles r WHERE r.user_id = u.id) AS roles
    FROM admin_users u WHERE ${CAN_SIGN_IN_SQL.replace(/\b(active|invite_state|removed_at)\b/g, "u.$1")} ORDER BY u.name`)).rows;
  return rows.flatMap((r) => {
    const founder = isFounder(String(r.roles ?? "").split(",").filter(Boolean));
    if (!founder && !(box === "hello" && Number(r.email_access) === 1)) return [];
    const name = [String(r.name), r.last_name ? String(r.last_name) : ""].filter(Boolean).join(" ");
    return [{ id: String(r.id), name, avatarUrl: avatarFor(String(r.id), Number(r.has_avatar) === 1, r.updated_at, String(r.email)) }];
  });
}
