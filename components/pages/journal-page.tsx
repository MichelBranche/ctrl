import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dict, localize, type Locale } from "@/lib/i18n";

export function journalMetadata(lang: Locale): Metadata {
  return { title: "Journal", description: dict[lang].journal.description };
}

export function JournalView({ lang }: { lang: Locale }) {
  const t = dict[lang].journal;
  return (
    <>
      <SiteHeader />
      <main className="subpage">
        <p className="kicker">Journal</p>
        <h1>
          {t.title.map((line) => (
            <span className="h-line" key={line}>
              {line}
            </span>
          ))}
        </h1>
        <ol className="notes">
          {t.notes.map((note, i) => (
            <li key={note.title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2>{note.title}</h2>
                <p>{note.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href={localize("/#work", lang)} className="text-link">
          {t.explore}
          <ArrowIcon />
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
