import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleView, articleMetadata } from "@/components/journal/article-page";
import { getPublishedPosts } from "@/lib/journal";

type Props = { params: Promise<{ slug: string }> };

/** Cache Components needs at least one param; a placeholder slug renders the 404. */
export async function generateStaticParams() {
  const posts = await getPublishedPosts("it");
  return posts.length ? posts.slice(0, 20).map((p) => ({ slug: p.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return articleMetadata("it", slug);
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<main className="j-root" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const { slug } = await params;
  return <ArticleView lang="it" slug={slug} />;
}
