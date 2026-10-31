import "server-only";

const ENDPOINT = "https://api-free.deepl.com/v2/translate";

export const translationConfigured = () => Boolean(process.env.DEEPL_API_KEY);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Wraps everything that must not be translated in <x> (DeepL ignore_tags): code, URLs, Markdown line markers, HTML. */
function protect(block: string): string {
  const keep: string[] = [];
  const hold = (s: string) => `\u0000${keep.push(s) - 1}\u0000`;
  let s = block
    .replace(/`[^`\n]+`/g, hold)
    .replace(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (m) => "](" + hold(m.slice(2, -1)) + ")")
    .replace(/<[^>\n]+>/g, hold)
    .replace(/\bhttps?:\/\/[^\s)<]+/g, hold)
    .replace(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?|\|)+)/gm, hold);
  s = esc(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<x>${esc(keep[Number(i)])}</x>`);
}

const restore = (s: string) => unesc(s.replace(/<\/?x>/g, ""));

async function deepl(texts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += 40) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texts.slice(i, i + 40),
        source_lang: "IT",
        target_lang: "EN-GB",
        tag_handling: "xml",
        ignore_tags: ["x"],
        preserve_formatting: true,
        split_sentences: "nonewlines",
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
    const json = (await res.json()) as { translations?: { text: string }[] };
    if (!json.translations || json.translations.length !== texts.slice(i, i + 40).length) throw new Error("DeepL bad response");
    out.push(...json.translations.map((t) => t.text));
  }
  return out;
}

/** Splits Markdown into blocks; fenced code and blank lines pass through untouched, every other block is translated. */
function blocks(md: string): { text: string; translate: boolean }[] {
  const out: { text: string; translate: boolean }[] = [];
  const parts = md.replace(/\r\n/g, "\n").split(/(^```[\s\S]*?^```[^\n]*$|\n{2,})/m);
  for (const p of parts) {
    if (!p) continue;
    out.push({ text: p, translate: !/^```/.test(p) && p.trim() !== "" });
  }
  return out;
}

export type PostText = { title: string; excerpt: string; cover_alt: string; body_md: string };

/** Italian -> English for a journal post. Throws on missing key or API failure. */
export async function translatePost(p: PostText): Promise<PostText> {
  if (!translationConfigured()) throw new Error("DEEPL_API_KEY missing");
  const body = blocks(p.body_md);
  const queue = [p.title, p.excerpt, p.cover_alt, ...body.filter((b) => b.translate).map((b) => b.text)];
  const idx = queue.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  const done = await deepl(idx.map((i) => protect(queue[i])));
  const result = [...queue];
  idx.forEach((i, k) => (result[i] = restore(done[k])));
  let j = 3;
  const body_md = body.map((b) => (b.translate ? result[j++] : b.text)).join("");
  return { title: result[0], excerpt: result[1], cover_alt: result[2], body_md };
}
