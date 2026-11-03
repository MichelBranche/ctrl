import "server-only";
import { createHash } from "node:crypto";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { MailLabel, MailCategory, MailMutation, Address, FolderId, MailAttachment, MailMessage, MailSummary } from "@/lib/mail/types";

/**
 * Everything the admin needs from a mailbox. The real implementation speaks IMAP/SMTP (imap.ts);
 * a fake one (mock.ts) serves seeded messages for local tests. IMAP leases bounded,
 * short-lived connections scoped to one account within a warm server instance.
 */
export interface MailProvider {
  /** Folder list with unread counts, one page of a folder (newest first) and optionally one opened message with its conversation. */
  view(query: ViewQuery): Promise<MailboxView>;
  unread(): Promise<number>;
  mutate?(folder: FolderId, uids: number[], operation: MailMutation, label?: string): Promise<void>;
  createLabel?(name: string): Promise<void>;
  saveDraft?(mail: OutgoingMail, previousUid?: number): Promise<number>;
  /** Marks a message seen/unseen on the server (\Seen flag). */
  setSeen(folder: FolderId, uid: number, seen: boolean): Promise<void>;
  attachment(folder: FolderId, uid: number, pick: { index?: number; cid?: string }): Promise<AttachmentFile | null>;
  /** For replies: the headers needed to thread the answer. */
  replyContext(folder: FolderId, uid: number): Promise<ReplyContext | null>;
  send(mail: OutgoingMail): Promise<{ messageId: string }>;
}

export type ViewQuery = { folder: FolderId; page: number; open?: number | null; search?: string; category?: MailCategory };
export type FolderInfo = { id: FolderId; unread: number; total: number };
export type MailboxView = {
  labels?: MailLabel[];
  folders: FolderInfo[];
  list: MailSummary[];
  total: number;
  open: MailMessage | null;
  thread: MailSummary[];
};
export type AttachmentFile = { filename: string; contentType: string; content: Buffer };
export type ReplyContext = { messageId: string | null; references: string[]; subject: string; replyTo: Address[]; from: Address | null; to: Address[]; cc: Address[] };
export type OutgoingFile = { filename: string; contentType: string; content: Buffer };
export type OutgoingMail = { attachments?: OutgoingFile[]; attachmentsFrom?: { folder: FolderId; uid: number }; to: string[]; cc: string[]; subject: string; text: string; inReplyTo?: string | null; references?: string[] };

export const PAGE_SIZE = 30;
/** Messages bigger than this are not downloaded for viewing (Vercel function memory and time). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export const messageKey = (messageId: string | null | undefined, fallback: string) =>
  createHash("sha256").update(messageId?.trim() || fallback).digest("hex").slice(0, 32);

const addresses = (v: AddressObject | AddressObject[] | undefined): Address[] =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((o) => o.value).filter((a) => a.address).map((a) => ({ name: a.name ?? "", address: a.address ?? "" }));

export async function parseSource(source: Buffer): Promise<ParsedMail> {
  return simpleParser(source, { skipTextToHtml: true, skipImageLinks: true, maxHtmlLengthToParse: 2_000_000 });
}

/** Full message from its RFC 822 source; `base` supplies folder/uid/flags from the mailbox listing. */
export function toMessage(parsed: ParsedMail, base: Omit<MailSummary, "hasAttachments" | "key"> & { key?: string }): MailMessage {
  const attachments: MailAttachment[] = parsed.attachments.map((a, index) => ({
    index,
    filename: a.filename || `allegato-${index + 1}`,
    contentType: a.contentType || "application/octet-stream",
    size: a.size ?? a.content.length,
    inline: a.contentDisposition === "inline" && Boolean(a.cid),
  }));
  const refs = parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : [];
  return {
    ...base,
    key: base.key ?? messageKey(parsed.messageId, `${base.folder}:${base.uid}`),
    from: addresses(parsed.from)[0] ?? base.from,
    to: addresses(parsed.to),
    cc: addresses(parsed.cc),
    replyTo: addresses(parsed.replyTo),
    subject: parsed.subject ?? base.subject,
    messageId: parsed.messageId ?? null,
    references: refs,
    html: typeof parsed.html === "string" ? parsed.html : null,
    text: parsed.text ?? "",
    hasAttachments: attachments.some((a) => !a.inline),
    attachments,
  };
}

export function pickAttachment(parsed: ParsedMail, pick: { index?: number; cid?: string }): AttachmentFile | null {
  const a = pick.cid ? parsed.attachments.find((x) => x.cid === pick.cid) : parsed.attachments[pick.index ?? -1];
  if (!a) return null;
  return { filename: a.filename || "allegato", contentType: a.contentType || "application/octet-stream", content: a.content };
}

export function replyContextOf(parsed: ParsedMail): ReplyContext {
  const refs = parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : [];
  return {
    messageId: parsed.messageId ?? null,
    references: refs,
    subject: parsed.subject ?? "",
    replyTo: addresses(parsed.replyTo),
    from: addresses(parsed.from)[0] ?? null,
    to: addresses(parsed.to),
    cc: addresses(parsed.cc),
  };
}

/** Error shown to people: never includes credentials or raw server responses. */
export class MailError extends Error {
  constructor(public kind: "auth" | "network" | "notfound" | "toolarge" | "unknown", message: string) {
    super(message);
  }
}
