import type { Locale } from "@/lib/i18n";

export const CATEGORIES = ["design", "tecnologia", "strategia", "innovazione", "brand", "case-study"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Locale, Record<Category, string>> = {
  it: { design: "Design", tecnologia: "Tecnologia", strategia: "Strategia", innovazione: "Innovazione", brand: "Brand", "case-study": "Case study" },
  en: { design: "Design", tecnologia: "Technology", strategia: "Strategy", innovazione: "Innovation", brand: "Brand", "case-study": "Case study" },
};

export type PostStatus = "draft" | "published";

export type Post = {
  id: string;
  slug: string;
  lang: Locale;
  title: string;
  category: Category;
  excerpt: string;
  body_md: string;
  cover_url: string | null;
  cover_alt: string;
  status: PostStatus;
  published_at: string;
};

export function formatPostDate(iso: string, lang: Locale) {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString(lang === "it" ? "it-IT" : "en-GB", { month: "short", timeZone: "UTC" }).replace(".", "");
  return `${day} ${month} ${d.getUTCFullYear()}`;
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
