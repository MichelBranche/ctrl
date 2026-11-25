import type { MetadataRoute } from "next";
import { projectCategories, services, websitesInOrder } from "@/lib/content";
import { getPublishedPosts } from "@/lib/journal";
import { getShopProducts } from "@/lib/shop";
import { SHOP_ENABLED } from "@/lib/features";

const siteUrl = "https://www.ctrlagency.dev";
/** Day the public titles, descriptions and structured data were revised. */
const UPDATED = new Date("2026-11-11T00:00:00.000Z");

function enPath(itPath: string): string {
  if (itPath === "/") return "/en";
  if (itPath === "/cookie") return "/en/cookies";
  return `/en${itPath}`;
}

function dePath(itPath: string): string {
  if (itPath === "/") return "/de";
  if (itPath === "/cookie") return "/de/cookies";
  return `/de${itPath}`;
}

function frPath(itPath: string): string {
  if (itPath === "/") return "/fr";
  if (itPath === "/cookie") return "/fr/cookies";
  return `/fr${itPath}`;
}

function priorityFor(path: string): number {
  if (path === "/" || path === "/en" || path === "/de" || path === "/fr") return 1;
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
  const de = dePath(itPath);
  const fr = frPath(itPath);
  const languages = { "it-IT": `${siteUrl}${itPath}`, "en-US": `${siteUrl}${en}`, "de-DE": `${siteUrl}${de}`, "fr-FR": `${siteUrl}${fr}` };
  return [entry(itPath, lastModified, languages), entry(en, lastModified, languages), entry(de, lastModified, languages), entry(fr, lastModified, languages)];
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
  "/contact",
  "/bookings",
  "/privacy",
  "/cookie",
  "/agenzia-web-valle-d-aosta",
  "/services/webapp",
  "/services/web-security",
  "/projects/webapps/agenda-easy",
  "/ctrl-quotes",
  ...projectCategories.filter((category) => !category.href).map((category) => `/projects/${category.slug}`),
  ...services.map((service) => `/services/${service.slug}`),
  ...websitesInOrder().map((project) => `/projects/websites/${project.slug}`),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [italianPosts, englishPosts, germanPosts, frenchPosts, shopProducts] = await Promise.all([getPublishedPosts("it"), getPublishedPosts("en"), getPublishedPosts("de"), getPublishedPosts("fr"), getShopProducts()]);
  const englishBySlug = new Map(englishPosts.map((post) => [post.slug, post]));
  const germanBySlug = new Map(germanPosts.map((post) => [post.slug, post]));
  const frenchBySlug = new Map(frenchPosts.map((post) => [post.slug, post]));
  const italianSlugs = new Set(italianPosts.map((post) => post.slug));

  const journal: MetadataRoute.Sitemap = [];
  for (const post of italianPosts) {
    const when = dated(post.published_at);
    const english = englishBySlug.get(post.slug);
    const german = germanBySlug.get(post.slug);
    const french = frenchBySlug.get(post.slug);
    const itUrl = `${siteUrl}/journal/${post.slug}`;
    const enUrl = `${siteUrl}/en/journal/${post.slug}`;
    const deUrl = `${siteUrl}/de/journal/${post.slug}`;
    const frUrl = `${siteUrl}/fr/journal/${post.slug}`;
    const languages: Record<string, string> = { "it-IT": itUrl };
    if (english) languages["en-US"] = enUrl;
    if (german) languages["de-DE"] = deUrl;
    if (french) languages["fr-FR"] = frUrl;
    journal.push(entry(`/journal/${post.slug}`, when, languages));
    if (english) journal.push(entry(`/en/journal/${post.slug}`, dated(english.published_at), languages));
    if (german) journal.push(entry(`/de/journal/${post.slug}`, dated(german.published_at), languages));
    if (french) journal.push(entry(`/fr/journal/${post.slug}`, dated(french.published_at), languages));
  }
  for (const post of englishPosts) {
    if (italianSlugs.has(post.slug)) continue;
    const enUrl = `${siteUrl}/en/journal/${post.slug}`;
    journal.push(entry(`/en/journal/${post.slug}`, dated(post.published_at), { "en-US": enUrl }));
  }
  for (const post of germanPosts) {
    if (italianSlugs.has(post.slug) || englishBySlug.has(post.slug)) continue;
    const deUrl = `${siteUrl}/de/journal/${post.slug}`;
    journal.push(entry(`/de/journal/${post.slug}`, dated(post.published_at), { "de-DE": deUrl }));
  }
  for (const post of frenchPosts) {
    if (italianSlugs.has(post.slug) || englishBySlug.has(post.slug) || germanBySlug.has(post.slug)) continue;
    const frUrl = `${siteUrl}/fr/journal/${post.slug}`;
    journal.push(entry(`/fr/journal/${post.slug}`, dated(post.published_at), { "fr-FR": frUrl }));
  }

  // Shop hidden (lib/features): neither /shop nor product pages go in the sitemap.
  const shopPages: MetadataRoute.Sitemap = SHOP_ENABLED ? paired("/shop", UPDATED) : [];
  const shop: MetadataRoute.Sitemap = shopProducts
    .filter((product) => SHOP_ENABLED && product.published)
    .flatMap((product) => {
      const created = dated(product.createdAt);
      return paired(`/shop/${product.slug}`, created > UPDATED ? created : UPDATED);
    });

  const pages = staticItalianPaths.flatMap((path) => paired(path, UPDATED));
  const seen = new Set<string>();
  return [...pages, ...shopPages, ...journal, ...shop].filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
