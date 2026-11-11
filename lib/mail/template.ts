/*
 * CTRL branded email (Kallebe's design): orange header with the C mark, white card, body, signature,
 * contacts and footer. Pure and dependency-free so the compose preview (client) and the send path
 * (server) produce byte-identical HTML. Email-client safe: tables, inline styles, no scripts; the only image is the sender photo (absolute https URL).
 * Everything the user typed is HTML-escaped; only a tiny markdown subset becomes markup.
 */
import { CONTACT_PHONE } from "@/lib/content";

const ACCENT = "#ff4a1c";
const SITE = "ctrlagency.dev";
/** Standard signature delimiter: lets drafts strip the signature before re-editing. */
export const SIG_DELIM = "\n\n-- \n";
/** Who is sending: name, roles already joined ("Founder e Designer UI/UX"), optional absolute https photo URL. */
export type EmailSender = { name: string; role?: string | null; photoUrl?: string | null };
const CONTACTS_TEXT = `Telefono: ${CONTACT_PHONE}\nSito: https://${SITE}`;
/** Per-sender signature (no fixed names): "Nome Cognome\nRuolo\nCtrl Agency", or just "Ctrl Agency" without a sender. */
export const signatureText = (sender?: EmailSender | null) =>
  `${sender?.name ? `${sender.name}\n` : ""}${sender?.role ? `${sender.role}\n` : ""}Ctrl Agency\n\n${CONTACTS_TEXT}`;
export const SIGNATURE_TEXT = signatureText(null);
const FOOTER_TEXT = "CTRL AGENCY · Soluzioni digitali per imprese e professionisti";
const LEGAL = "Hai ricevuto questa email perché sei in contatto con Ctrl Agency. Se non desideri altre comunicazioni, rispondi a questa email e non ti scriveremo più.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escaped text with links (http/https, www., emails), **bold**, *italic* and [label](https://url). */
export function inlineMarkup(raw: string): string {
  const out: string[] = [];
  const re = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)|(https?:\/\/[^\s<>"]{1,500}[^\s<>".,;:!?)\]])|(www\.[^\s<>"]{1,300}[^\s<>".,;:!?)\]])|([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,24})/g;
  let last = 0;
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:#1a56db;text-decoration:underline" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const emph = (s: string) => esc(s).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  for (const m of raw.matchAll(re)) {
    out.push(emph(raw.slice(last, m.index)));
    if (m[1]) out.push(link(m[2], esc(m[1])));
    else if (m[3]) out.push(link(m[3], esc(m[3])));
    else if (m[4]) out.push(link(`https://${m[4]}`, esc(m[4])));
    else out.push(link(`mailto:${m[5]}`, esc(m[5])));
    last = m.index + m[0].length;
  }
  out.push(emph(raw.slice(last)));
  return out.join("");
}

const P = "margin:0 0 14px;font-size:14px;line-height:1.6;color:#222222";

/** Body text to HTML blocks: paragraphs, line breaks, "- " lists and "> " quoted replies. */
function bodyHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(`<p style="${P}">${para.map(inlineMarkup).join("<br>")}</p>`);
    if (list.length) blocks.push(`<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:#222222">${list.map((l) => `<li>${inlineMarkup(l)}</li>`).join("")}</ul>`);
    if (quote.length) blocks.push(`<blockquote style="margin:0 0 14px;padding:0 0 0 12px;border-left:3px solid #dddddd;color:#666666;font-size:13px;line-height:1.5">${quote.map(inlineMarkup).join("<br>")}</blockquote>`);
    para = []; list = []; quote = [];
  };
  for (const line of lines) {
    const q = /^>\s?(.*)$/.exec(line);
    const li = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (q) { if (para.length || list.length) { const keep = quote; quote = []; flush(); quote = keep; } quote.push(q[1]); }
    else if (!line.trim()) flush();
    else if (li) { if (para.length || quote.length) flush(); list.push(li[1]); }
    else { if (list.length || quote.length) flush(); para.push(line); }
  }
  flush();
  return blocks.join("\n");
}

function signatureHtml(sender?: EmailSender | null) {
  const photo = sender?.photoUrl && /^https:\/\/[^\s"<>]+$/.test(sender.photoUrl) ? sender.photoUrl : null;
  const lines = `${sender?.name ? `<strong style="color:#111111">${esc(sender.name)}</strong><br>` : ""}${sender?.role ? `${esc(sender.role)}<br>` : ""}Ctrl Agency`;
  // Centered like the old founders signature: photo above, text below, email-safe table with align=center.
  const img = photo ? `<tr><td align="center" style="padding:0 0 10px"><img src="${esc(photo)}" width="48" height="48" alt="${esc(sender?.name ?? "")}" style="display:block;margin:0 auto;width:48px;height:48px;border-radius:50%;object-fit:cover;border:0"></td></tr>\n` : "";
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 14px"><tr><td align="center">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
${img}<tr><td align="center" style="font:14px/1.45 Arial,Helvetica,sans-serif;color:#333333;text-align:center">${lines}</td></tr>
</table>
</td></tr></table>`;
}

/** Both MIME parts for a message the user typed. The text part carries the same signature after "-- ". */
export function brandedEmail(body: string, opts: { cta?: { label: string; href: string }; legal?: boolean; sender?: EmailSender | null } = {}): { html: string; text: string } {
  const clean = body.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  // Bulletproof table button (Outlook-safe). Only https links: never javascript: or data: from any caller.
  const cta = opts.cta && /^https:\/\/[^\s"<>]+$/.test(opts.cta.href) ? opts.cta : null;
  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px"><tr><td bgcolor="#0c0c0c" style="background:#0c0c0c;border-radius:999px">
<a href="${esc(cta.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">${esc(cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#666666">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${esc(cta.href)}" style="color:#1a56db;word-break:break-all">${esc(cta.href)}</a></p>`
    : "";
  const ctaText = cta ? `\n\n${cta.label}: ${cta.href}` : "";
  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Ctrl Agency</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif">
<tr><td bgcolor="${ACCENT}" style="background:${ACCENT};padding:18px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font:900 22px/1 Arial,Helvetica,sans-serif;color:#0c0c0c;padding-right:10px">C</td>
<td style="font:700 15px/1 Arial,Helvetica,sans-serif;color:#0c0c0c">Ctrl Agency</td>
</tr></table></td></tr>
<tr><td style="padding:28px 24px 8px">
${bodyHtml(clean)}
${ctaHtml}
${signatureHtml(opts.sender)}
<p align="center" style="${P};text-align:center">Telefono: <a href="tel:${CONTACT_PHONE}" style="color:#1a56db">${CONTACT_PHONE}</a><br>Sito: <a href="https://${SITE}" style="color:#1a56db" target="_blank" rel="noopener noreferrer">${SITE}</a></p>
</td></tr>
<tr><td style="padding:18px 24px 22px;border-top:1px solid #eeeeee">
<p style="margin:0 0 4px;font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.08em;color:#111111">CTRL AGENCY</p>
<p style="margin:0 0 10px;font:12px/1.4 Arial,Helvetica,sans-serif;color:#666666">Soluzioni digitali per imprese e professionisti</p>
${opts.legal ? `<p style="margin:0;font:10px/1.5 Arial,Helvetica,sans-serif;color:#999999">${esc(LEGAL)}</p>` : ""}
</td></tr>
</table></td></tr></table>
</body></html>`;
  return { html, text: `${clean}${ctaText}${SIG_DELIM}${signatureText(opts.sender)}\n\n${FOOTER_TEXT}\n` };
}

/** Removes the signature added by brandedEmail (for re-editing a saved draft). */
export const stripSignature = (text: string) => {
  const i = text.indexOf("\n-- \n");
  return i >= 0 ? text.slice(0, i).replace(/\s+$/, "") : text;
};
