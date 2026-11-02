/* Shared-inbox types used by server code and client components (no secrets, no server imports). */

export const FOLDERS = ["inbox", "sent", "spam"] as const;
/** Visible folders plus "all" (Gmail All Mail), used only to open messages of a conversation. */
export type FolderId = (typeof FOLDERS)[number] | "all";
export const FOLDER_LABEL: Record<FolderId, string> = { inbox: "In arrivo", sent: "Inviati", spam: "Spam", all: "Tutta la posta" };
export const isFolder = (v: unknown): v is FolderId => v === "all" || FOLDERS.includes(v as (typeof FOLDERS)[number]);

export type Address = { name: string; address: string };

export type MailSummary = {
  folder: FolderId;
  uid: number;
  /** Stable id across folders (hash of the RFC Message-ID), used for the collaboration table. */
  key: string;
  from: Address | null;
  to: Address[];
  subject: string;
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  threadId: string | null;
};

export type MailAttachment = { index: number; filename: string; contentType: string; size: number; inline: boolean };

export type MailMessage = MailSummary & {
  cc: Address[];
  replyTo: Address[];
  messageId: string | null;
  references: string[];
  /** Raw HTML from the sender: always passed through sanitizeEmailHtml before it reaches a browser. */
  html: string | null;
  text: string;
  attachments: MailAttachment[];
};

export type Collab = { readBy: { id: string; name: string }[]; claimedBy: { id: string; name: string; at: string } | null };
