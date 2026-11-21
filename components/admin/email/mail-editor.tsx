"use client";

import { useEffect, useRef, useState } from "react";
import { MailIcon } from "@/components/admin/email/mailbox-ui";

/*
 * Rich editor for the composer. The send pipeline keeps the same plain-text markup
 * (**grassetto**, *corsivo*, __sottolineato__, "- " and "1. " lists, [testo](https://…)),
 * so the editor only converts between that markup and contenteditable HTML.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(line: string): string {
  return esc(line)
    .replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)/g, (_m, label: string, url: string) => `<a href="${url}">${label}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(*>])__([^_\n]+)__(?=[\s).,;:!?*<]|$)/g, "$1<u>$2</u>")
    .replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,;:!?<]|$)/g, "$1<i>$2</i>");
}

export function markupToHtml(md: string): string {
  const out: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</${list.tag}>`); list = null; };
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const ul = /^\s*[-*•]\s+(.+)$/.exec(line);
    const ol = ul ? null : /^\s*\d{1,3}[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      if (list && list.tag !== tag) flush();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    out.push(line.trim() ? `<div>${inlineHtml(line)}</div>` : "<div><br></div>");
  }
  flush();
  return out.join("");
}

const BLOCK = new Set(["DIV", "P", "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3"]);

export function htmlToMarkup(root: HTMLElement): string {
  let out = "";
  const nl = () => { if (out && !out.endsWith("\n")) out += "\n"; };
  const walk = (node: Node, ctx: { list?: "ul" | "ol"; n?: { i: number } }) => {
    if (node.nodeType === Node.TEXT_NODE) { out += (node.textContent ?? "").replace(/\u00a0/g, " "); return; }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    const kids = (c = ctx) => node.childNodes.forEach((child) => walk(child, c));
    const wrap = (mark: string) => {
      const before = out; out = ""; kids(); const inner = out; out = before;
      out += inner.trim() ? `${mark}${inner}${mark}` : inner;
    };
    if (tag === "BR") { out += "\n"; return; }
    if (tag === "B" || tag === "STRONG") return wrap("**");
    if (tag === "I" || tag === "EM") return wrap("*");
    if (tag === "U") return wrap("__");
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      const before = out; out = ""; kids(); const inner = out; out = before;
      out += /^https?:\/\//.test(href) && inner.trim() && inner !== href ? `[${inner}](${href})` : inner;
      return;
    }
    if (tag === "UL" || tag === "OL") { nl(); kids({ list: tag === "UL" ? "ul" : "ol", n: { i: 0 } }); nl(); return; }
    if (tag === "LI") { nl(); if (ctx.n) ctx.n.i += 1; out += ctx.list === "ol" ? `${ctx.n?.i ?? 1}. ` : "- "; kids({}); nl(); return; }
    if (BLOCK.has(tag)) {
      nl();
      // An empty block (<div><br></div>) is one blank line.
      if (node.childNodes.length === 1 && node.firstChild?.nodeName === "BR") { out += "\n"; return; }
      kids(); nl(); return;
    }
    kids();
  };
  root.childNodes.forEach((child) => walk(child, {}));
  return out.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
}

function Tool({ icon, text, run, pressed, disabled }: { icon: string; text: string; run: () => void; pressed?: boolean; disabled?: boolean }) {
  return <button type="button" className="mail-editor-tool" title={text} aria-label={text} aria-pressed={pressed} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={run}><MailIcon name={icon} size={16} /></button>;
}

const EMOJI = ["🙂", "😊", "😄", "🙏", "👍", "👋", "🎉", "✅", "📎", "📅", "💡", "🚀", "❤️", "👀", "✨", "☕"];

type Props = {
  initial: string; onChange: (markup: string) => void; disabled?: boolean; autoFocus?: boolean;
  onAttach: () => void; onImage: () => void; extra?: React.ReactNode; label?: string;
};

export function RichEditor({ initial, onChange, disabled, autoFocus, onAttach, onImage, extra, label = "Messaggio" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = markupToHtml(initial);
    if (autoFocus) {
      el.focus();
      const range = document.createRange(); range.selectNodeContents(el); range.collapse(true);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    }
    // The editor owns its DOM after mount; a new `initial` remounts it via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sync = () => { if (ref.current) onChange(htmlToMarkup(ref.current)); };
  const exec = (command: string, value?: string) => { ref.current?.focus(); document.execCommand(command, false, value); sync(); };
  return (
    <div className="mail-editor" data-disabled={disabled || undefined}>
      <div
        ref={ref}
        className="mail-editor-area"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); sync(); }}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey)) return;
          const k = e.key.toLowerCase();
          if (k === "b" || k === "i" || k === "u") { e.preventDefault(); exec(k === "b" ? "bold" : k === "i" ? "italic" : "underline"); }
        }}
      />
      <div className="mail-editor-bar" role="toolbar" aria-label="Formattazione">
        <Tool icon="bold" text="Grassetto" disabled={disabled} run={() => exec("bold")} />
        <Tool icon="italic" text="Corsivo" disabled={disabled} run={() => exec("italic")} />
        <Tool icon="underline" text="Sottolineato" disabled={disabled} run={() => exec("underline")} />
        <span className="mail-editor-sep" />
        <Tool icon="ul" text="Elenco puntato" disabled={disabled} run={() => exec("insertUnorderedList")} />
        <Tool icon="ol" text="Elenco numerato" disabled={disabled} run={() => exec("insertOrderedList")} />
        <span className="mail-editor-sep" />
        <Tool icon="link" text="Inserisci link" disabled={disabled} run={() => {
          const url = window.prompt("Indirizzo del link (https://…)", "https://");
          if (url && /^https?:\/\/\S+$/.test(url.trim())) exec("createLink", url.trim());
        }} />
        <Tool icon="image" text="Allega immagine" disabled={disabled} run={onImage} />
        <Tool icon="clip" text="Allega file" disabled={disabled} run={onAttach} />
        <span className="mail-editor-pop-wrap">
          <Tool icon="emoji" text="Emoji" disabled={disabled} run={() => { setEmoji((v) => !v); setMore(false); }} pressed={emoji} />
          {emoji ? <span className="mail-editor-pop mail-emoji" role="menu">{EMOJI.map((e) => <button key={e} type="button" role="menuitem" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { exec("insertText", e); setEmoji(false); }}>{e}</button>)}</span> : null}
        </span>
        <span className="mail-editor-pop-wrap">
          <Tool icon="more" text="Altre opzioni" disabled={disabled} run={() => { setMore((v) => !v); setEmoji(false); }} pressed={more} />
          {more ? <span className="mail-editor-pop mail-editor-more" role="menu">
            <button type="button" role="menuitem" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { exec("removeFormat"); exec("unlink"); setMore(false); }}>Rimuovi formattazione</button>
            <button type="button" role="menuitem" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { exec("insertHorizontalRule"); setMore(false); }}>Riga di separazione</button>
          </span> : null}
        </span>
        {extra ? <span className="mail-editor-extra">{extra}</span> : null}
      </div>
    </div>
  );
}
