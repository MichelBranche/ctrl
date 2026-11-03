export const MAIL_STATUSES = { todo: "Da gestire", working: "In lavorazione", waiting: "In attesa del cliente", done: "Conclusa" } as const;
export type MailStatus = keyof typeof MAIL_STATUSES;
export function isMailStatus(value: unknown): value is MailStatus { return typeof value === "string" && Object.hasOwn(MAIL_STATUSES, value); }
export type InternalNote = { id: number; name: string; avatarUrl: string | null; body: string; at: string };
