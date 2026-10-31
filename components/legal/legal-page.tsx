import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PostBody } from "@/components/journal/markdown";
import { cookies, LEGAL_UPDATED, privacy } from "@/components/legal/legal-copy";
import type { Locale } from "@/lib/i18n";
import "@/components/journal/journal.css";
import "./legal.css";

const DOCS = { privacy, cookies };
type Doc = keyof typeof DOCS;
const PATHS: Record<Doc, Record<Locale, string>> = {
  privacy: { it: "/privacy", en: "/en/privacy" },
  cookies: { it: "/cookie", en: "/en/cookies" },
};

export function legalMetadata(doc: Doc, lang: Locale): Metadata {
  const d = DOCS[doc][lang];
  return {
    title: `${d.title} · CTRL®`,
    description: d.lead,
    alternates: { canonical: PATHS[doc][lang], languages: { it: PATHS[doc].it, en: PATHS[doc].en } },
  };
}

export function LegalView({ doc, lang }: { doc: Doc; lang: Locale }) {
  const d = DOCS[doc][lang];
  return (
    <>
      <SiteHeader />
      <main className="j-root j-article l-root">
        <header className="j-a-head">
          <h1 className="j-a-title">{d.title}</h1>
          <p className="j-a-lead">{d.lead}</p>
        </header>
        <div className="j-a-body">
          <PostBody source={d.body} />
          <p className="l-updated">
            {lang === "it" ? "Ultimo aggiornamento" : "Last updated"}: {LEGAL_UPDATED[lang]}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
