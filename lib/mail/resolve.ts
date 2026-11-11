import type { MailProvider, OpenedMessage } from "@/lib/mail/provider";
import type { FolderId } from "@/lib/mail/types";

/*
 * Finds a message we have seen before, shared by the desk link (/admin/desk/email) and the CRM contact email view.
 * UIDs are per folder and can change after a move, so the stable key (hash of the Message-ID) is checked first;
 * when it no longer matches, the stored Message-ID is searched again in All Mail, Trash and Spam.
 */

/** The Message-ID comes from the sender: keep only RFC 5322 id characters so it cannot add Gmail search operators. */
export function safeMessageId(raw: unknown): string | null {
  const id = String(raw ?? "").replace(/[<>]/g, "");
  return id && id.length <= 250 && /^[\w.!#$%&'*+/=?^`{|}~@-]+$/.test(id) ? id : null;
}

export type Located =
  | { kind: "same"; folder: FolderId; uid: number; detail: OpenedMessage }
  | { kind: "moved"; folder: FolderId; uid: number }
  | { kind: "missing" };

export async function locateMessage(
  provider: Pick<MailProvider, "message" | "findByMessageId">,
  /** messageId may be a loader: it is read only when the uid no longer holds the key. */
  ref: { folder: FolderId; uid: number; key: string; messageId?: string | null | (() => Promise<string | null>) },
): Promise<Located> {
  if (Number.isSafeInteger(ref.uid) && ref.uid > 0) {
    const detail = await provider.message(ref.folder, ref.uid);
    if (detail.open?.key === ref.key) return { kind: "same", folder: ref.folder, uid: ref.uid, detail };
  }
  const messageId = safeMessageId(typeof ref.messageId === "function" ? await ref.messageId() : ref.messageId);
  if (messageId) {
    const found = await provider.findByMessageId(messageId);
    if (found && found.key === ref.key) return { kind: "moved", folder: found.folder, uid: found.uid };
  }
  return { kind: "missing" };
}
