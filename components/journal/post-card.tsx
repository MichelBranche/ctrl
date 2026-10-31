import Image from "next/image";
import Link from "next/link";
import { JArrow } from "@/components/journal/arrow";
import { localize, type Locale } from "@/lib/i18n";
import { CATEGORY_LABEL, formatPostDate, type Post } from "@/lib/journal-types";

export function PostCard({ post, lang, read }: { post: Post; lang: Locale; read: string }) {
  return (
    <article className="j-card" data-j-card>
      <Link href={localize(`/journal/${post.slug}`, lang)} className="j-card-link">
        <div className="j-card-media">
          {post.cover_url ? (
            <Image src={post.cover_url} alt={post.cover_alt} fill sizes="(max-width: 760px) 90vw, 22vw" className="j-card-img" />
          ) : (
            <span className="j-card-ph" aria-hidden="true">CTRL®</span>
          )}
        </div>
        <div className="j-card-body">
          <p className="j-meta">
            <time dateTime={post.published_at}>{formatPostDate(post.published_at, lang)}</time>
            <span className="j-dot" aria-hidden="true" />
            <span>{CATEGORY_LABEL[lang][post.category]}</span>
          </p>
          <h2 className="j-card-title">{post.title}</h2>
          {post.excerpt ? <p className="j-card-excerpt">{post.excerpt}</p> : null}
          <span className="j-read">
            {read}
            <JArrow />
          </span>
        </div>
      </Link>
    </article>
  );
}
