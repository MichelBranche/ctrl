import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Row } from "@libsql/client";
import type { Locale } from "@/lib/i18n";
import { db, dbConfigured } from "@/lib/db";
import { fixturePosts } from "@/lib/journal-fixtures";
import type { Category, Post } from "@/lib/journal-types";

export const POSTS_TAG = "posts";
export const POST_COLUMNS = "id, slug, lang, title, category, excerpt, body_md, cover_url, cover_alt, published, published_at, updated_at";

/** Dev-only sample posts for visual checks. Never active in production builds. */
const useFixtures = process.env.NODE_ENV !== "production" && process.env.JOURNAL_FIXTURES === "1";

export function rowToPost(r: Row): Post & { updated_at: string } {
  return {
    id: String(r.id),
    slug: String(r.slug),
    lang: r.lang === "en" ? "en" : "it",
    title: String(r.title),
    category: String(r.category) as Category,
    excerpt: String(r.excerpt ?? ""),
    body_md: String(r.body_md ?? ""),
    cover_url: r.cover_url ? String(r.cover_url) : null,
    cover_alt: String(r.cover_alt ?? ""),
    status: Number(r.published) === 1 ? "published" : "draft",
    published_at: String(r.published_at),
    updated_at: String(r.updated_at ?? ""),
  };
}

/** Published posts for one language, newest first. Cached; publishing calls updateTag(POSTS_TAG). */
export async function getPublishedPosts(lang: Locale): Promise<Post[]> {
  "use cache";
  cacheTag(POSTS_TAG);
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
  if (useFixtures) return fixturePosts.filter((p) => p.lang === lang);
  if (!dbConfigured) return [];
  try {
    const res = await db().execute({
      sql: `SELECT ${POST_COLUMNS} FROM posts WHERE lang = ? AND published = 1 ORDER BY published_at DESC LIMIT 500`,
      args: [lang],
    });
    return res.rows.map(rowToPost);
  } catch (error) {
    console.error("[journal] list failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getPublishedPost(lang: Locale, slug: string): Promise<Post | null> {
  const posts = await getPublishedPosts(lang);
  return posts.find((p) => p.slug === slug) ?? null;
}
