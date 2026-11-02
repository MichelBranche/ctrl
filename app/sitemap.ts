import type { MetadataRoute } from "next";
import { projectCategories, services, websitesInOrder } from "@/lib/content";
import { getPublishedPosts } from "@/lib/journal";
import { getShopProducts } from "@/lib/shop";

const siteUrl = "https://www.ctrlagency.dev";
const publicPaths = [
  "/", "/projects", "/services", "/team", "/journal", "/shop", "/contact", "/privacy", "/cookie",
  "/en", "/en/projects", "/en/services", "/en/team", "/en/journal", "/en/shop", "/en/contact", "/en/privacy", "/en/cookies",
  ...projectCategories.flatMap((category) => [`/projects/${category.slug}`, `/en/projects/${category.slug}`]),
  ...services.flatMap((service) => [`/services/${service.slug}`, `/en/services/${service.slug}`]),
  "/services/webapp",
  "/en/services/webapp",
  "/projects/webapps/agenda-easy",
  "/en/projects/webapps/agenda-easy",
  ...websitesInOrder().flatMap((project) => [`/projects/websites/${project.slug}`, `/en/projects/websites/${project.slug}`]),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [italianPosts, englishPosts, shopProducts] = await Promise.all([getPublishedPosts("it"), getPublishedPosts("en"), getShopProducts()]);
  const articlePaths = [
    ...italianPosts.map((post) => `/journal/${post.slug}`),
    ...englishPosts.map((post) => `/en/journal/${post.slug}`),
  ];
  const shopPaths = shopProducts.filter((product) => product.published).flatMap((product) => [`/shop/${product.slug}`, `/en/shop/${product.slug}`]);
  const entries: MetadataRoute.Sitemap = [...new Set([...publicPaths, ...articlePaths, ...shopPaths])].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path.includes("/journal") ? "weekly" : "monthly",
    priority: path === "/" || path === "/en" ? 1 : 0.7,
  }));
  return entries;
}
