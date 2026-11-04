/*
 * The iframe document every email is shown in (received, sent, drafts and the compose preview).
 * Strict CSP: no scripts, no forms, no remote loads except images when the user asked for them.
 * Light neutral page like Gmail, isolated from the admin's dark theme.
 */
export function emailDocument(body: string, showImages: boolean): string {
  const img = showImages ? "img-src 'self' data: https: http:;" : "img-src 'self' data:;";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img} style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><base target="_blank"><style>
:root{color-scheme:light only}html{background:#fff;overflow-x:auto}body{margin:0;padding:16px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#222;background:#fff;word-wrap:break-word}
img{max-width:100%;height:auto}.ctrl-blocked-img{display:inline-block;color:#888;font-size:12px}
.ctrl-text{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 Arial,Helvetica,sans-serif;margin:0}
a{color:#1a56db}
</style></head><body>${body}</body></html>`;
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain-text-only mail: escaped, line breaks kept, links and addresses clickable. Shown in the same iframe. */
export function textDocumentBody(text: string): string {
  const re = /(https?:\/\/[^\s<>"]{1,1000}[^\s<>".,;:!?)\]])|([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,24})/g;
  let out = "", last = 0;
  for (const m of text.matchAll(re)) {
    out += escText(text.slice(last, m.index));
    const href = m[1] ?? `mailto:${m[2]}`;
    out += `<a href="${escText(href).replace(/"/g, "&quot;")}" rel="noopener noreferrer nofollow" target="_blank">${escText(m[0])}</a>`;
    last = m.index + m[0].length;
  }
  return `<pre class="ctrl-text">${out + escText(text.slice(last))}</pre>`;
}
