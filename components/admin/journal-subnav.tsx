import Link from "next/link";

/** Shown only when the person can open both the article list and the media library. */
export function JournalSubnav({ current, articles, media }: { current: "articles" | "media"; articles: boolean; media: boolean }) {
  if (!articles || !media) return null;
  return (
    <nav className="adm-tabs" aria-label="Sezioni journal">
      <Link href="/admin/journal" className="adm-tab" aria-current={current === "articles" ? "page" : undefined}>
        Articoli
      </Link>
      <Link href="/admin/journal/media" className="adm-tab" aria-current={current === "media" ? "page" : undefined}>
        Media
      </Link>
    </nav>
  );
}
