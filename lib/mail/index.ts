import "server-only";
import { ImapProvider } from "@/lib/mail/imap";
import { MockProvider } from "@/lib/mail/mock";
import type { MailProvider } from "@/lib/mail/provider";
import { MAILBOX_IDS, type MailboxId, type MailboxInfo } from "@/lib/mail/mailbox-types";
import { isFounder, type Perms } from "@/lib/team-types";

export { MAILBOX_IDS, isMailboxId, type MailboxId, type MailboxInfo } from "@/lib/mail/mailbox-types";

/**
 * Agency mailboxes. Each one is a Gmail account read over IMAP; credentials come only from env vars (a Gmail app
 * password; spaces as shown by Google are ignored). They are read here and passed to the IMAP/SMTP clients, never
 * logged, rendered or sent to the browser.
 *  - "hello": the shared agency inbox (AGENCY_IMAP_USER / AGENCY_IMAP_PASSWORD, visible sender MAIL_FROM). Everyone
 *    with the Email permission, founders always.
 *  - "admin": amministrazione@, founders only (ADMIN_IMAP_USER / ADMIN_IMAP_PASSWORD, optional ADMIN_MAIL_FROM).
 *    Without its env vars the mailbox simply does not exist: no selector, no error.
 * AGENCY_MAIL_MOCK=1 serves a fake "hello" for local tests (ADMIN_MAIL_MOCK=1 also a fake "admin"); ignored on
 * Vercel production. CRM, AI context and the desk links keep using "hello" only.
 */
type Account = { user: string; pass: string; fromName: string; fromAddress: string; resendOnly: boolean };
// Reuse only the current account's provider within this warm server instance.
// A credential change discards all of its short-lived mailbox metadata.
const current = new Map<MailboxId, { sig: string; provider: MailProvider }>();
const mocks = new Map<MailboxId, MailProvider>();
const mockAllowed = () => process.env.VERCEL_ENV !== "production";

/** Parses `Name <a@b>` or a bare address. Null if unset or malformed. */
function parseFrom(raw: string | undefined): { name: string | null; address: string } | null {
  const v = raw?.trim();
  if (!v) return null;
  const m = /^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/.exec(v) ?? /^()([^<>\s"]+@[^<>\s"]+)$/.exec(v);
  return m ? { name: m[1]?.trim() || null, address: m[2] } : null;
}

/** MAIL_FROM (e.g. `CTRL® <hello@ctrlagency.dev>` or a bare address), a Gmail "Send mail as" alias. Null if unset or malformed. */
export const mailFrom = () => parseFrom(process.env.MAIL_FROM);

const ADMIN_ADDRESS = "amministrazione@ctrlagency.dev";

function account(box: MailboxId): Account | null {
  if (box === "hello") {
    const user = process.env.AGENCY_IMAP_USER?.trim();
    const pass = process.env.AGENCY_IMAP_PASSWORD?.replace(/\s+/g, "");
    if (!user || !pass) return null;
    const alias = mailFrom();
    return { user, pass, fromName: alias?.name || process.env.AGENCY_MAIL_FROM_NAME?.trim() || "CTRL", fromAddress: alias?.address || user, resendOnly: false };
  }
  const user = process.env.ADMIN_IMAP_USER?.trim();
  const pass = process.env.ADMIN_IMAP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  const from = parseFrom(process.env.ADMIN_MAIL_FROM);
  // Without a Gmail "Send mail as" alias the Gmail SMTP fallback would show the private Gmail address: Resend only.
  return { user, pass, fromName: from?.name || "CTRL® Amministrazione", fromAddress: from?.address || ADMIN_ADDRESS, resendOnly: !from };
}

const mockOn = (box: MailboxId) => mockAllowed() && (box === "hello" ? process.env.AGENCY_MAIL_MOCK === "1" : process.env.ADMIN_MAIL_MOCK === "1");

export function mailProvider(box: MailboxId = "hello"): MailProvider | null {
  const acc = account(box);
  if (acc) {
    const sig = [acc.user, acc.pass, acc.fromName, acc.fromAddress, acc.resendOnly].join("\u0000");
    const hit = current.get(box);
    if (hit?.sig === sig) return hit.provider;
    const provider = new ImapProvider(acc);
    current.set(box, { sig, provider });
    return provider;
  }
  current.delete(box);
  if (mockOn(box)) {
    if (box === "hello") return new MockProvider();
    let p = mocks.get(box);
    if (!p) { p = new MockProvider({ address: "amministrazione@example.test", flavour: "admin" }); mocks.set(box, p); }
    return p;
  }
  return null;
}

/** Address shown in the UI ("da: …"). Only the mailbox address, never the password. */
export function mailboxAddress(box: MailboxId = "hello"): string | null {
  const acc = account(box);
  if (acc) return acc.fromAddress;
  if (mockOn(box)) return box === "hello" ? "agenzia@example.test" : "amministrazione@example.test";
  return null;
}
export const agencyAddress = () => mailboxAddress("hello");

const LABEL: Record<MailboxId, { label: string; description: string }> = {
  hello: { label: "Agenzia", description: "Casella condivisa dell'agenzia" },
  admin: { label: "Amministrazione", description: "Casella riservata ai founder" },
};

/** Who may open a mailbox: hello with the Email permission (checked by the caller), admin founders only. */
export const canUseMailbox = (user: Perms, box: MailboxId) => (box === "admin" ? isFounder(user) : true);

/** Configured mailboxes this user may read and send from, in display order. */
export function mailboxesFor(user: Perms): MailboxInfo[] {
  return MAILBOX_IDS.filter((id) => canUseMailbox(user, id)).flatMap((id) => {
    const address = mailboxAddress(id);
    return address ? [{ id, address, ...LABEL[id] }] : [];
  });
}

/** A requested mailbox id if configured and allowed for this user, else null (never falls back silently to another box). */
export function resolveMailbox(user: Perms, raw: unknown): MailboxId | null {
  const id = raw === undefined || raw === null || raw === "" ? "hello" : raw;
  return mailboxesFor(user).find((b) => b.id === id)?.id ?? null;
}

/** Every address that is "us" (any mailbox alias and Gmail login), lowercased, for reply-all and thread labels. */
export const isAgencyAddress = (a: string | null | undefined) => {
  if (!a) return false;
  const v = a.toLowerCase();
  return [mailFrom()?.address, process.env.AGENCY_IMAP_USER?.trim(), agencyAddress(), process.env.ADMIN_IMAP_USER?.trim(), mailboxAddress("admin"), ADMIN_ADDRESS]
    .some((x) => x && x.toLowerCase() === v);
};
