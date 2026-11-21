/** Mailbox ids shared by server and client (no secrets, no server imports). */
export const MAILBOX_IDS = ["hello", "admin"] as const;
export type MailboxId = (typeof MAILBOX_IDS)[number];
export const isMailboxId = (v: unknown): v is MailboxId => typeof v === "string" && (MAILBOX_IDS as readonly string[]).includes(v);
export type MailboxInfo = { id: MailboxId; address: string; label: string; description: string };
