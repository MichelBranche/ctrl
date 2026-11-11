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
let current: { user: string; pass: string; fromName: string; fromAddress: string; provider: ImapProvider } | undefined;

/** MAIL_FROM (e.g. `CTRL® <hello@ctrlagency.dev>` or a bare address), a Gmail "Send mail as" alias. Null if unset or malformed. */
export function mailFrom(): { name: string | null; address: string } | null {
  const raw = process.env.MAIL_FROM?.trim();
  if (!raw) return null;
  const m = /^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/.exec(raw) ?? /^()([^<>\s"]+@[^<>\s"]+)$/.exec(raw);
  return m ? { name: m[1]?.trim() || null, address: m[2] } : null;
}

export function mailProvider(): MailProvider | null {
  const user = process.env.AGENCY_IMAP_USER?.trim();
  const pass = process.env.AGENCY_IMAP_PASSWORD?.replace(/\s+/g, "");
  if (user && pass) {
    const alias = mailFrom();
    const fromName = alias?.name || process.env.AGENCY_MAIL_FROM_NAME?.trim() || "CTRL";
    const fromAddress = alias?.address || user;
    if (!current || current.user !== user || current.pass !== pass || current.fromName !== fromName || current.fromAddress !== fromAddress) {
      current = { user, pass, fromName, fromAddress, provider: new ImapProvider({ user, pass, fromName, fromAddress }) };
    }
    return current.provider;
  }
  current = undefined;
  if (process.env.AGENCY_MAIL_MOCK === "1" && process.env.VERCEL_ENV !== "production") return new MockProvider();
  return null;
}

/** Address shown in the UI ("da: …"). Only the mailbox address, never the password. */
export const agencyAddress = () => (process.env.AGENCY_IMAP_USER?.trim() ? mailFrom()?.address || process.env.AGENCY_IMAP_USER.trim() : null) || (process.env.AGENCY_MAIL_MOCK === "1" && process.env.VERCEL_ENV !== "production" ? "agenzia@example.test" : null);

/** Every address that is "us" (MAIL_FROM alias and the Gmail login), lowercased, for reply-all and thread labels. */
export const isAgencyAddress = (a: string | null | undefined) =>
  !!a && [mailFrom()?.address, process.env.AGENCY_IMAP_USER?.trim(), agencyAddress()].some((x) => x && x.toLowerCase() === a.toLowerCase());
