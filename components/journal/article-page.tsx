import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { JArrow } from "@/components/journal/arrow";
import { journalCopy } from "@/components/journal/journal-copy";
import { JournalMotion } from "@/components/journal/journal-motion";
import { PostBody } from "@/components/journal/markdown";
import { PostCard } from "@/components/journal/post-card";
import { localize, type Locale } from "@/lib/i18n";
import { getPublishedPost, getPublishedPosts } from "@/lib/journal";
import { CATEGORY_LABEL, formatPostDate } from "@/lib/journal-types";
import "./journal.css";

export async function articleMetadata(lang: Locale, slug: string): Promise<Metadata> {
  const post = await getPublishedPost(lang, slug);
  if (!post) return { title: journalCopy[lang].metaTitle, robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt || journalCopy[lang].metaDescription,
    alternates: { canonical: localize(`/journal/${post.slug}`, lang) },
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.published_at, images: post.cover_url ? [post.cover_url] : undefined },
  };
}

function readingMinutes(md: string) {
  return Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 220));
}

export async function ArticleView({ lang, slug }: { lang: Locale; slug: string }) {
  const c = journalCopy[lang];
  const posts = await getPublishedPosts(lang);
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  const others = posts.filter((p) => p.id !== post.id);
  const related = [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 2);

  return (
    <>
      <SiteHeader />
      <main className="j-root j-article" data-motion-root>
        <JournalMotion />
        <header className="j-a-head">
          <Link href={localize("/journal", lang)} className="j-back" data-j-fade>
            <JArrow className="j-arrow j-arrow-back" />
            {c.back}
          </Link>
          <p className="j-meta" data-j-fade>
            <time dateTime={post.published_at}>{formatPostDate(post.published_at, lang)}</time>
            <span className="j-dot" aria-hidden="true" />
            <span>{CATEGORY_LABEL[lang][post.category]}</span>
            <span className="j-dot" aria-hidden="true" />
            <span>
              {readingMinutes(post.body_md)} {c.minutes}
            </span>
          </p>
          <h1 className="j-a-title" data-j-split>{post.title}</h1>
          {post.excerpt ? <p className="j-a-lead" data-j-fade>{post.excerpt}</p> : null}
        </header>
        {post.cover_url ? (
          <figure className="j-a-cover">
            <Image src={post.cover_url} alt={post.cover_alt} fill priority sizes="(max-width: 1100px) 100vw, 72rem" className="j-a-cover-img" data-j-hero-img />
          </figure>
        ) : null}
        <div className="j-a-body" data-j-fade-scroll>
          <PostBody source={post.body_md} />
        </div>
        {related.length ? (
          <section className="j-related" aria-labelledby="j-related-h">
            <h2 id="j-related-h" className="j-related-h" data-j-fade-scroll>{c.related}</h2>
            <div className="j-grid">
              {related.map((p) => (
                <PostCard key={p.id} post={p} lang={lang} read={c.read} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
