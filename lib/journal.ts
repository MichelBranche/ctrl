import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/lib/i18n";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { fixturePosts } from "@/lib/journal-fixtures";
import type { Post } from "@/lib/journal-types";

export const POSTS_TAG = "posts";
const COLUMNS = "id, slug, lang, title, category, excerpt, body_md, cover_url, cover_alt, status, published_at";

/** Dev-only sample posts for visual checks. Never active in production builds. */
const useFixtures = process.env.NODE_ENV !== "production" && process.env.JOURNAL_FIXTURES === "1";

function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Published posts for one language, newest first. RLS returns published rows only. */
export async function getPublishedPosts(lang: Locale): Promise<Post[]> {
  "use cache";
  cacheTag(POSTS_TAG);
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
  if (useFixtures) return fixturePosts.filter((p) => p.lang === lang);
  if (!supabaseConfigured) return [];
  const { data, error } = await publicClient()
    .from("posts")
    .select(COLUMNS)
    .eq("lang", lang)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[journal] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Post[];
}

export async function getPublishedPost(lang: Locale, slug: string): Promise<Post | null> {
  const posts = await getPublishedPosts(lang);
  return posts.find((p) => p.slug === slug) ?? null;
}
