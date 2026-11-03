import "server-only";
import { ImapProvider } from "@/lib/mail/imap";
import { MockProvider } from "@/lib/mail/mock";
import type { MailProvider } from "@/lib/mail/provider";

/**
 * The agency inbox provider. Credentials come only from AGENCY_IMAP_USER / AGENCY_IMAP_PASSWORD
 * (a Gmail app password; spaces as shown by Google are ignored). They are read here and passed to
 * the IMAP/SMTP clients, never logged, rendered or sent to the browser.
 * AGENCY_MAIL_MOCK=1 serves a fake mailbox for local tests; it is ignored on Vercel production.
 */
// Reuse only the current account's provider within this warm server instance.
// A credential change discards all of its short-lived mailbox metadata.
let current: { user: string; pass: string; fromName: string; provider: ImapProvider } | undefined;

export function mailProvider(): MailProvider | null {
  const user = process.env.AGENCY_IMAP_USER?.trim();
  const pass = process.env.AGENCY_IMAP_PASSWORD?.replace(/\s+/g, "");
  if (user && pass) {
    const fromName = process.env.AGENCY_MAIL_FROM_NAME?.trim() || "CTRL";
    if (!current || current.user !== user || current.pass !== pass || current.fromName !== fromName) {
      current = { user, pass, fromName, provider: new ImapProvider({ user, pass, fromName }) };
    }
    return current.provider;
  }
  current = undefined;
  if (process.env.AGENCY_MAIL_MOCK === "1" && process.env.VERCEL_ENV !== "production") return new MockProvider();
  return null;
}

/** Address shown in the UI ("da: …"). Only the mailbox address, never the password. */
export const agencyAddress = () => process.env.AGENCY_IMAP_USER?.trim() || (process.env.AGENCY_MAIL_MOCK === "1" && process.env.VERCEL_ENV !== "production" ? "agenzia@example.test" : null);
