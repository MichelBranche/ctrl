import "server-only";
import { db } from "@/lib/db";
import { ensureDeskSchema } from "@/lib/migrate";
import type { MailboxView } from "@/lib/mail/provider";

export async function rememberMailReferences(view: MailboxView) {
  await ensureDeskSchema();
  const items = [...view.list, ...view.thread, ...(view.open ? [view.open] : [])];
  const unique = [...new Map(items.map(item => [item.key, item])).values()];
  if (!unique.length) return;
  await db().batch(unique.map(item => ({ sql: `INSERT INTO email_references(message_key,folder,uid,subject,sender,message_id) VALUES(?,?,?,?,?,?)
    ON CONFLICT(message_key) DO UPDATE SET folder=excluded.folder,uid=excluded.uid,subject=excluded.subject,sender=excluded.sender,message_id=COALESCE(excluded.message_id,email_references.message_id)`,
    args: [item.key,item.folder,item.uid,item.subject,item.from?.name || item.from?.address || "",view.open?.key===item.key ? view.open.messageId : null] })), "write");
}
