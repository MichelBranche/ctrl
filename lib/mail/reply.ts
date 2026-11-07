import "server-only";
import { isAgencyAddress } from "@/lib/mail";
import type { Address, MailMessage } from "@/lib/mail/types";

/* Reply prefill shared by Posta and the CRM contact email view: same recipients, subject and quote everywhere. */

const TZ = "Europe/Rome";
export const longDate = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
export const who = (a: Address | null | undefined) => (a ? a.name || a.address : "—");
export const fmtAddr = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);

function quote(msg: MailMessage) {
  const lines = msg.text.trim().split("\n").slice(0, 200).map((l) => `> ${l}`);
  return `\n\n\nIl ${longDate(msg.date)}, ${who(msg.from)} ha scritto:\n${lines.join("\n")}`;
}

export function replyDraft(msg: MailMessage, all: boolean) {
  const target = msg.folder === "sent" || isAgencyAddress(msg.from?.address) ? msg.to : msg.replyTo.length ? msg.replyTo : msg.from ? [msg.from] : [];
  const cc = all ? [...(msg.folder === "sent" || isAgencyAddress(msg.from?.address) ? [] : msg.to), ...msg.cc].filter((a) => !isAgencyAddress(a.address) && !target.some((t) => t.address === a.address)) : [];
  return {
    to: target.map(fmtAddr).join(", "),
    cc: cc.map(fmtAddr).join(", "),
    subject: /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`,
    body: quote(msg),
  };
}
