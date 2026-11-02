import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Turns sender HTML into something safe to show inside a sandboxed iframe (no scripts allowed there either):
 * - drops scripts, iframes, objects, forms, event handlers and non-http(s)/mailto links;
 * - remote images (and CSS url(...)) are removed unless `showImages`, so opening a mail doesn't ping trackers;
 * - cid: images point at our authenticated attachment route.
 */
export function sanitizeEmailHtml(html: string, opts: { showImages: boolean; cidUrl: (cid: string) => string }): { html: string; blockedImages: number } {
  let blockedImages = 0;
  const cssUrl = /url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  const cleanCss = (css: string) =>
    css
      .replace(/@import[^;]*;?/gi, "")
      .replace(/expression\s*\(/gi, "")
      .replace(/behavior\s*:/gi, "")
      .replace(cssUrl, (_m, _q, url: string) => {
        if (/^cid:/i.test(url)) return `url("${opts.cidUrl(url.slice(4))}")`;
        if (/^data:image\//i.test(url)) return `url("${url}")`;
        if (opts.showImages && /^https?:\/\//i.test(url)) return `url("${url}")`;
        blockedImages++;
        return "none";
      });

  const out = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((t) => t !== "style"),
      "img", "font", "center", "span", "div", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "col", "colgroup", "style",
    ],
    disallowedTagsMode: "discard",
    allowVulnerableTags: true, // only <style>, whose content is cleaned in textFilter/transform below
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "dir", "title", "class", "border", "cellpadding", "cellspacing", "colspan", "rowspan"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    allowProtocolRelative: false,
    nonTextTags: ["script", "textarea", "option", "noscript", "title"],
    transformTags: {
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
      img: (tag, attribs) => {
        const src = attribs.src ?? "";
        if (/^cid:/i.test(src)) return { tagName: "img", attribs: { ...attribs, src: opts.cidUrl(src.slice(4)) } };
        if (/^data:image\/(png|jpe?g|gif|webp);/i.test(src)) return { tagName: "img", attribs };
        if (opts.showImages && /^https?:\/\//i.test(src)) return { tagName: "img", attribs };
        blockedImages++;
        return { tagName: "span", attribs: { class: "ctrl-blocked-img", title: attribs.alt ?? "" }, text: attribs.alt ? `[${attribs.alt}]` : "" };
      },
    },
    textFilter: (text, tagName) => (tagName === "style" ? cleanCss(text) : text),
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
  // Inline style attributes may also carry url(...): clean them after sanitizing.
  const html2 = out.replace(/style="([^"]*)"/gi, (_m, css: string) => `style="${cleanCss(css.replace(/&quot;/g, '"')).replace(/"/g, "&quot;")}"`);
  return { html: html2, blockedImages };
}

/** Wraps sanitized HTML in a document for an iframe srcdoc with a strict CSP (no scripts, no remote loads unless allowed). */
export function emailDocument(body: string, showImages: boolean): string {
  const img = showImages ? "img-src 'self' data: https: http:;" : "img-src 'self' data:;";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img} style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><base target="_blank"><style>
html{color-scheme:light}body{margin:0;padding:16px;font:14px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:#111;background:#fff;word-wrap:break-word;overflow-wrap:anywhere}
img{max-width:100%;height:auto}table{max-width:100%}.ctrl-blocked-img{display:inline-block;color:#888;font-size:12px}
</style></head><body>${body}</body></html>`;
}
