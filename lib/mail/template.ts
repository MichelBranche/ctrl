/*
 * CTRL branded email: white card, message body, two-column signature (CTRL® mark | sender), footer with services.
 * Pure and dependency-free so the compose preview (client) and the send path (server) produce byte-identical HTML.
 * Email-client safe: tables, inline styles, no scripts, no SVG. Works with images blocked: the CTRL® mark is a table
 * cell, contact rows use text labels; the only image is the sender photo (absolute https URL, alt = name), and without
 * a photo an initials cell takes its place. A small <style> only stacks the columns on narrow screens.
 * Payoff, services and links come from the public site (lib/i18n.ts home.heroLine, lib/content.ts, lib/ecosystem.ts).
 * Everything the user typed is HTML-escaped; only a tiny markdown subset becomes markup.
 */
const ACCENT = "#ff4a1c";
/** Text links: the brand orange darkened to about 4.6:1 on white, so links stay readable. */
const LINK = "#c93a12";
const ORIGIN = "https://www.ctrlagency.dev";
const SITE = "www.ctrlagency.dev";
/** Site hero line (lib/i18n.ts it.home.heroLine[0]). */
const PAYOFF = "Brand, siti web e software su misura.";
/** Site hero title (lib/i18n.ts it.home.title). */
const FOOTER_PAYOFF = "Dall'identità al prodotto.";
/** Offers already live on the site (real paths), plus the Ecosistema products. */
export const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "Siti web", href: `${ORIGIN}/projects/websites` },
  { label: "Webapp", href: `${ORIGIN}/services/webapp` },
  { label: "Software", href: `${ORIGIN}/projects/software` },
  { label: "Brand", href: `${ORIGIN}/projects/brand-identity` },
  { label: "CTRL® Quotes", href: `${ORIGIN}/ctrl-quotes` },
  { label: "Agenda Easy", href: "https://agendaeasy.it" },
];
/** Standard signature delimiter: lets drafts strip the signature before re-editing. */
export const SIG_DELIM = "\n\n-- \n";
/**
 * Who is sending, all from the sender's own admin profile: name, roles already joined ("Founder e Designer UI/UX"),
 * optional absolute https photo URL, phone and contact email. A missing field hides its line: never a shared or fixed value.
 */
export type EmailSender = { name: string; role?: string | null; photoUrl?: string | null; phone?: string | null; email?: string | null };
/** Same rule as the profile form: digits, +, spaces, dots, dashes, parentheses. Anything else is dropped. */
export const signaturePhone = (sender?: EmailSender | null) => {
  const v = sender?.phone?.trim();
  return v && /^[+0-9().\s-]{3,40}$/.test(v) && /\d/.test(v) ? v : null;
};
export const signatureEmail = (sender?: EmailSender | null) => {
  const v = sender?.email?.trim();
  return v && v.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : null;
};
const contactsText = (sender?: EmailSender | null) => {
  const phone = signaturePhone(sender), email = signatureEmail(sender);
  return `${phone ? `Tel. ${phone}\n` : ""}${email ? `Email ${email}\n` : ""}Web ${ORIGIN}`;
};
/** Per-sender signature (no fixed names): "Nome Cognome\nRuolo\nCTRL® Agency" and contacts, or just the agency without a sender. */
export const signatureText = (sender?: EmailSender | null) =>
  `${sender?.name ? `${sender.name}\n` : ""}${sender?.role ? `${sender.role}\n` : ""}CTRL® Agency · ${PAYOFF}\n\n${contactsText(sender)}`;
export const SIGNATURE_TEXT = signatureText(null);
const FOOTER_TEXT = `CTRL® Agency · ${FOOTER_PAYOFF}\n${FOOTER_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n")}`;
const LEGAL = "Hai ricevuto questa email perché sei in contatto con Ctrl Agency. Se non desideri altre comunicazioni, rispondi a questa email e non ti scriveremo più.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escaped text with links (http/https, www., emails), **bold**, *italic* and [label](https://url). */
export function inlineMarkup(raw: string): string {
  const out: string[] = [];
  const re = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)|(https?:\/\/[^\s<>"]{1,500}[^\s<>".,;:!?)\]])|(www\.[^\s<>"]{1,300}[^\s<>".,;:!?)\]])|([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,24})/g;
  let last = 0;
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:${LINK};text-decoration:underline" target="_blank" rel="noopener noreferrer">${label}</a>`;
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

const FONT = "Arial,Helvetica,sans-serif";
const a = (href: string, label: string) =>
  `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="color:${LINK};text-decoration:underline">${label}</a>`;

/** The CTRL® mark without images: a rounded orange cell with a bold white C (square corners where radius is unsupported). */
const MARK = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="${ACCENT}" style="width:40px;height:40px;background:${ACCENT};border-radius:9px;font:900 22px/40px ${FONT};color:#ffffff;text-align:center;mso-line-height-rule:exactly">C</td></tr></table>`;

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "C";

/** Round photo (black and white where filters work), alt = name. Without a photo: a grey cell with the initials. */
function avatarHtml(sender: EmailSender) {
  const photo = sender.photoUrl && /^https:\/\/[^\s"<>]+$/.test(sender.photoUrl) ? sender.photoUrl : null;
  const cell = (inner: string, extra = "") =>
    `<td width="56" valign="top" style="width:56px"><table role="presentation" width="56" cellpadding="0" cellspacing="0" border="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="#e9e9ea" style="width:56px;height:56px;border-radius:50%;background:#e9e9ea;${extra}">${inner}</td></tr></table></td>`;
  // With a photo the grey round cell and the styled alt text show while images are blocked.
  if (photo) return cell(`<img src="${esc(photo)}" width="56" height="56" alt="${esc(sender.name)}" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover;border:0;filter:grayscale(100%);font:700 10px/1.2 ${FONT};color:#333333;text-align:center">`);
  return cell(esc(initialsOf(sender.name)), `font:700 18px/56px ${FONT};color:#333333;text-align:center;mso-line-height-rule:exactly`);
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:2px 10px 2px 0;font:700 11px/1.5 ${FONT};color:#8a8a8a;letter-spacing:.04em;white-space:nowrap">${label}</td><td style="padding:2px 0;font:13px/1.5 ${FONT};color:#222222">${value}</td></tr>`;

function senderHtml(sender: EmailSender) {
  const phone = signaturePhone(sender), email = signatureEmail(sender);
  const rows = [
    phone ? row("Tel.", a(`tel:${phone.replace(/[^+0-9]/g, "")}`, esc(phone))) : "",
    email ? row("Email", a(`mailto:${email}`, esc(email))) : "",
    row("Web", a(ORIGIN, SITE)),
  ].join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${avatarHtml(sender)}
<td valign="top" style="padding-left:14px">
<p style="margin:0;font:700 15px/1.35 ${FONT};color:#111111">${esc(sender.name)}</p>
${sender.role ? `<p style="margin:2px 0 0;font:13px/1.4 ${FONT};color:#666666">${esc(sender.role)}</p>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${rows}</table>
</td></tr></table>`;
}

function brandHtml() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top">${MARK}</td></tr>
<tr><td style="padding-top:10px;font:700 15px/1.35 ${FONT};color:#111111">CTRL® Agency</td></tr>
<tr><td style="padding-top:2px;font:13px/1.45 ${FONT};color:#666666">${esc(PAYOFF)}</td></tr></table>`;
}

/** Two columns with a thin vertical divider; stacked on narrow screens (sig-col / sig-div). No sender: brand only. */
function signatureHtml(sender?: EmailSender | null) {
  if (!sender?.name) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid #eeeeee"><tr><td style="padding-top:20px">${brandHtml()}</td></tr></table>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid #eeeeee"><tr><td style="padding-top:20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="sig-col" width="200" valign="top" style="width:200px;padding-right:20px">${brandHtml()}</td>
<td class="sig-div" width="1" bgcolor="#e5e5e5" style="width:1px;background:#e5e5e5;font-size:0;line-height:0">&nbsp;</td>
<td class="sig-col sig-right" valign="top" style="padding-left:20px">${senderHtml(sender)}</td>
</tr></table>
</td></tr></table>`;
}

function footerHtml(legal?: boolean) {
  const links = FOOTER_LINKS.map((l) => `<span style="white-space:nowrap">${a(l.href, esc(l.label))}</span>`).join(`<span style="color:#c8c8c8"> &nbsp;|&nbsp; </span>`);
  return `<tr><td class="card-pad" style="padding:16px 28px 20px;border-top:1px solid #eeeeee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="sig-col" valign="top" style="padding:4px 16px 4px 0;font:12px/1.5 ${FONT};color:#666666;white-space:nowrap"><strong style="color:#111111">CTRL® Agency</strong><br>${esc(FOOTER_PAYOFF)}</td>
<td class="sig-col sig-links" valign="top" align="right" style="padding:4px 0;font:12px/1.8 ${FONT};color:#666666;text-align:right">${links}</td>
</tr></table>
${legal ? `<p style="margin:12px 0 0;font:10px/1.5 ${FONT};color:#8a8a8a">${esc(LEGAL)}</p>` : ""}
</td></tr>`;
}

const RESPONSIVE = `<style>
@media only screen and (max-width:520px){
.sig-col{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important;text-align:left!important}
.sig-div{display:none!important}
.sig-right{padding-top:18px!important}
.sig-links{text-align:left!important}
.card-pad{padding-left:20px!important;padding-right:20px!important}
}
</style>`;

/** Both MIME parts for a message the user typed. The text part carries the same signature after "-- ". */
export function brandedEmail(body: string, opts: { cta?: { label: string; href: string }; legal?: boolean; sender?: EmailSender | null } = {}): { html: string; text: string } {
  const clean = body.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  // Bulletproof table button (Outlook-safe). Only https links: never javascript: or data: from any caller.
  const cta = opts.cta && /^https:\/\/[^\s"<>]+$/.test(opts.cta.href) ? opts.cta : null;
  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px"><tr><td bgcolor="#0c0c0c" style="background:#0c0c0c;border-radius:999px">
<a href="${esc(cta.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${esc(cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#666666">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${esc(cta.href)}" style="color:${LINK};word-break:break-all">${esc(cta.href)}</a></p>`
    : "";
  const ctaText = cta ? `\n\n${cta.label}: ${cta.href}` : "";
  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>Ctrl Agency</title>
${RESPONSIVE}</head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;font-family:${FONT}">
<tr><td class="card-pad" style="padding:30px 28px 26px">
${bodyHtml(clean)}
${ctaHtml}
${signatureHtml(opts.sender)}
</td></tr>
${footerHtml(opts.legal)}
</table></td></tr></table>
</body></html>`;
  return { html, text: `${clean}${ctaText}${SIG_DELIM}${signatureText(opts.sender)}\n\n${FOOTER_TEXT}\n` };
}

/** Removes the signature added by brandedEmail (for re-editing a saved draft). */
export const stripSignature = (text: string) => {
  const i = text.indexOf("\n-- \n");
  return i >= 0 ? text.slice(0, i).replace(/\s+$/, "") : text;
};
