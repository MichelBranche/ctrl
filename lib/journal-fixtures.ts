import type { Post } from "@/lib/journal-types";

/**
 * DEV ONLY. Placeholder entries used to check the layout locally with
 * JOURNAL_FIXTURES=1. They are never read in production (see lib/journal.ts).
 */
const imgs = ["/images/hero.jpg", "/images/altura.jpg", "/images/mountain.jpg", "/images/novara.jpg", "/images/orbital.jpg"];
const cats = ["design", "tecnologia", "strategia", "innovazione", "case-study", "brand"] as const;

export const fixturePosts: Post[] = (["it", "en"] as const).flatMap((lang) =>
  Array.from({ length: 9 }, (_, i) => ({
    id: `${lang}-${i}`,
    slug: `fixture-${i + 1}`,
    lang,
    title: lang === "it" ? `Articolo di prova ${i + 1}: titolo su due righe` : `Sample entry ${i + 1}: a two line title`,
    category: cats[i % cats.length],
    excerpt: lang === "it" ? "Testo segnaposto per verificare impaginazione e ritmo della card." : "Placeholder text to check card layout and rhythm.",
    body_md:
      "## Sezione\n\nParagrafo di prova con **grassetto**, *corsivo* e un [link](https://ctrlagency.dev).\n\n> Una citazione di prova.\n\n- Punto uno\n- Punto due\n\n```ts\nconst ok = true;\n```\n\n<script>alert('raw html is ignored')</script>\n",
    cover_url: imgs[i % imgs.length],
    cover_alt: "",
    status: "published" as const,
    published_at: new Date(Date.UTC(2026, 9, 28 - i * 5)).toISOString(),
  })),
);
