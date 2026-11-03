/* Shared-inbox types used by server code and client components (no secrets, no server imports). */

export const FOLDERS = ["inbox", "starred", "sent", "drafts", "all", "spam", "trash"] as const;
/** Visible folders plus "all" (Gmail All Mail), used only to open messages of a conversation. */
export type FolderId = (typeof FOLDERS)[number] | `label:${string}`;
export const FOLDER_LABEL: Record<(typeof FOLDERS)[number], string> = { inbox: "In arrivo", sent: "Inviati", spam: "Spam", all: "Tutta la posta", starred: "Speciali", drafts: "Bozze", trash: "Cestino" };
export const isFolder = (v: unknown): v is FolderId => typeof v === "string" && (FOLDERS.includes(v as (typeof FOLDERS)[number]) || (v.startsWith("label:") && v.length > 6 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v)));

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
  starred?: boolean;
  labels?: string[];
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

export type Collab = { readBy: { id: string; name: string; avatarUrl?: string | null }[]; claimedBy: { id: string; name: string; avatarUrl?: string | null; at: string } | null };

export const folderLabel = (id: FolderId) => id.startsWith("label:") ? id.slice(6) : FOLDER_LABEL[id as keyof typeof FOLDER_LABEL];
export const CATEGORIES = { primary: "Principale", promotions: "Promozioni", social: "Social", updates: "Aggiornamenti", forums: "Forum" } as const;
export type MailCategory = keyof typeof CATEGORIES;
export type MailLabel = { id: `label:${string}`; name: string; unread: number; total: number };
export type MailMutation = "archive" | "trash" | "inbox" | "spam" | "read" | "unread" | "star" | "unstar" | "label" | "unlabel";
