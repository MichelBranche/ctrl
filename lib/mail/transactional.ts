import "server-only";
import type { MailProvider, OutgoingMail } from "@/lib/mail/provider";
import { brandedEmail } from "@/lib/mail/template";

export type TransactionalMail = Pick<OutgoingMail, "to" | "cc" | "subject" | "text" | "cta">;
export type MailVia = "resend" | "gmail";

/**
 * Transactional mail (invites, offboarding). With RESEND_API_KEY and MAIL_FROM set it goes out through the
 * Resend HTTP API from the agency domain, Reply-To the agency Gmail (AGENCY_IMAP_USER) so answers land there.
 * Without the key, or if Resend fails, it falls back to the Gmail SMTP provider. Keys are never logged.
 */
export async function sendTransactional(mail: TransactionalMail, provider: MailProvider | null): Promise<{ messageId: string; via: MailVia }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (key && from) {
    try {
      const replyTo = process.env.AGENCY_IMAP_USER?.trim();
      const body = brandedEmail(mail.text, { cta: mail.cta, legal: true });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: mail.to,
          ...(mail.cc.length ? { cc: mail.cc } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: mail.subject,
          html: body.html,
          text: body.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: unknown };
        return { messageId: typeof data.id === "string" ? data.id : "", via: "resend" };
      }
      console.warn(`[mail] Resend ha risposto ${res.status}, uso Gmail`);
    } catch {
      console.warn("[mail] Resend non raggiungibile, uso Gmail");
    }
  }
  if (!provider) throw new Error("Nessun provider email configurato");
  const { messageId } = await provider.send({ to: mail.to, cc: mail.cc, subject: mail.subject, text: mail.text, cta: mail.cta });
  return { messageId, via: "gmail" };
}
