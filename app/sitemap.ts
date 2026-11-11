import type { MetadataRoute } from "next";
import { projectCategories, services, websitesInOrder } from "@/lib/content";
import { getPublishedPosts } from "@/lib/journal";
import { getShopProducts } from "@/lib/shop";

const siteUrl = "https://www.ctrlagency.dev";
/** Day the public titles, descriptions and structured data were revised. */
const UPDATED = new Date("2026-11-11T00:00:00.000Z");

function enPath(itPath: string): string {
  if (itPath === "/") return "/en";
  if (itPath === "/cookie") return "/en/cookies";
  return `/en${itPath}`;
}

function priorityFor(path: string): number {
  if (path === "/" || path === "/en") return 1;
  if (path.includes("agenzia-web")) return 0.9;
  if (path.includes("residence-le-vele") || path.includes("/services")) return 0.8;
  return 0.7;
}

function frequencyFor(path: string): "weekly" | "monthly" {
  return path.includes("/journal") ? "weekly" : "monthly";
}

function entry(path: string, lastModified: Date, languages: Record<string, string>): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: frequencyFor(path),
    priority: priorityFor(path),
    alternates: { languages },
  };
}

function paired(itPath: string, lastModified: Date): MetadataRoute.Sitemap {
  const en = enPath(itPath);
  const languages = { "it-IT": `${siteUrl}${itPath}`, "en-US": `${siteUrl}${en}` };
  return [entry(itPath, lastModified, languages), entry(en, lastModified, languages)];
}

function dated(value: string | undefined): Date {
  const parsed = value ? new Date(value) : UPDATED;
  return Number.isNaN(parsed.getTime()) ? UPDATED : parsed;
}

const staticItalianPaths = [
  "/",
  "/projects",
  "/services",
  "/team",
  "/journal",
  "/shop",
  "/contact",
  "/bookings",
  "/privacy",
  "/cookie",
  "/agenzia-web-valle-d-aosta",
  "/services/webapp",
  "/services/web-security",
  "/projects/webapps/agenda-easy",
  ...projectCategories.filter((category) => !category.href).map((category) => `/projects/${category.slug}`),
  ...services.map((service) => `/services/${service.slug}`),
  ...websitesInOrder().map((project) => `/projects/websites/${project.slug}`),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [italianPosts, englishPosts, shopProducts] = await Promise.all([getPublishedPosts("it"), getPublishedPosts("en"), getShopProducts()]);
  const englishBySlug = new Map(englishPosts.map((post) => [post.slug, post]));
  const italianSlugs = new Set(italianPosts.map((post) => post.slug));

  const journal: MetadataRoute.Sitemap = [];
  for (const post of italianPosts) {
    const when = dated(post.published_at);
    const english = englishBySlug.get(post.slug);
    const itUrl = `${siteUrl}/journal/${post.slug}`;
    const enUrl = `${siteUrl}/en/journal/${post.slug}`;
    const languages: Record<string, string> = { "it-IT": itUrl };
    if (english) languages["en-US"] = enUrl;
    journal.push(entry(`/journal/${post.slug}`, when, languages));
    if (english) journal.push(entry(`/en/journal/${post.slug}`, dated(english.published_at), languages));
  }
  for (const post of englishPosts) {
    if (italianSlugs.has(post.slug)) continue;
    const enUrl = `${siteUrl}/en/journal/${post.slug}`;
    journal.push(entry(`/en/journal/${post.slug}`, dated(post.published_at), { "en-US": enUrl }));
  }

  const shop: MetadataRoute.Sitemap = shopProducts
    .filter((product) => product.published)
    .flatMap((product) => {
      const created = dated(product.createdAt);
      return paired(`/shop/${product.slug}`, created > UPDATED ? created : UPDATED);
    });

  const pages = staticItalianPaths.flatMap((path) => paired(path, UPDATED));
  const seen = new Set<string>();
  return [...pages, ...journal, ...shop].filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
