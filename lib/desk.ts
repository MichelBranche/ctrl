import "server-only";
import { db } from "@/lib/db";
import { discordEnabled, noticeInboxMail } from "@/lib/discord-notify";
import { ensureDeskSchema } from "@/lib/migrate";
import type { MailboxView } from "@/lib/mail/provider";

export async function rememberMailReferences(view: MailboxView) {
  await ensureDeskSchema();
  const items = [...view.list, ...view.thread, ...(view.open ? [view.open] : [])];
  const unique = [...new Map(items.map(item => [item.key, item])).values()];
  if (!unique.length) return;
  // The first time the mailbox is indexed, remember every row and stay quiet. Later, only a new unseen inbox message is a notice.
  // With the webhook unset these reads are skipped, so opening the mailbox stays as it was.
  const notify = discordEnabled();
  const prior = notify ? await db().execute("SELECT COUNT(*) AS n FROM email_references") : null;
  const primed = Number(prior?.rows[0]?.n ?? 0) > 0;
  const known = new Set<string>();
  if (primed) {
    const existing = await db().execute({
      sql: `SELECT message_key FROM email_references WHERE message_key IN (${unique.map(() => "?").join(",")})`,
      args: unique.map((item) => item.key),
    });
    for (const row of existing.rows) known.add(String(row.message_key));
  }
  await db().batch(unique.map(item => ({ sql: `INSERT INTO email_references(message_key,folder,uid,subject,sender,message_id) VALUES(?,?,?,?,?,?)
    ON CONFLICT(message_key) DO UPDATE SET folder=excluded.folder,uid=excluded.uid,subject=excluded.subject,sender=excluded.sender,message_id=COALESCE(excluded.message_id,email_references.message_id)`,
    args: [item.key,item.folder,item.uid,item.subject,item.from?.name || item.from?.address || "",view.open?.key===item.key ? view.open.messageId : null] })), "write");
  const fresh = notify && primed ? unique.filter((item) => item.folder === "inbox" && !item.seen && !known.has(item.key)) : [];
  if (!fresh.length) return;
  await noticeInboxMail(fresh.map((item) => ({
    key: item.key, uid: item.uid, subject: item.subject, fromName: item.from?.name ?? "", fromAddress: item.from?.address ?? "",
  }))).catch((error) => {
    console.error("[discord] mail notice failed:", error instanceof Error ? error.message : error);
  });
}

/** Message-ID remembered for a stable key (by any list or opened message), for the shared resolver's fallback. */
export async function rememberedMessageId(key: string): Promise<string | null> {
  await ensureDeskSchema();
  const r = await db().execute({ sql: "SELECT message_id FROM email_references WHERE message_key = ?", args: [key] });
  const v = r.rows[0]?.message_id;
  return typeof v === "string" && v ? v : null;
}
