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
      "img", "font", "center", "span", "div", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "col", "colgroup", "style", "u", "s", "small", "big", "sub", "sup", "hr", "wbr",
    ],
    disallowedTagsMode: "discard",
    allowVulnerableTags: true, // only <style>, whose content is cleaned in textFilter/transform below
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "dir", "lang", "title", "class", "role", "border", "cellpadding", "cellspacing", "colspan", "rowspan", "nowrap", "hspace", "vspace"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "border"],
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

export { emailDocument, textDocumentBody } from "@/lib/mail/document";
