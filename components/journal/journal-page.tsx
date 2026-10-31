import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { JournalBrowser } from "@/components/journal/journal-browser";
import { journalCopy } from "@/components/journal/journal-copy";
import { JournalMotion } from "@/components/journal/journal-motion";
import { Newsletter } from "@/components/journal/newsletter";
import { localize, type Locale } from "@/lib/i18n";
import { getPublishedPosts } from "@/lib/journal";
import "./journal.css";

export function journalMetadata(lang: Locale): Metadata {
  const c = journalCopy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: localize("/journal", lang), languages: { it: "/journal", en: "/en/journal" } },
  };
}

async function JournalPosts({ lang, copy }: { lang: Locale; copy: (typeof journalCopy)[Locale] }) {
  const posts = await getPublishedPosts(lang);
  return (
    <>
      <JournalBrowser posts={posts} lang={lang} copy={copy} />
      {/* Mounted inside the boundary so GSAP only touches hydrated nodes. */}
      <JournalMotion />
    </>
  );
}

export async function JournalView({ lang }: { lang: Locale }) {
  const c = journalCopy[lang];

  return (
    <>
      <SiteHeader />
      <main className="j-root" data-motion-root>
        <section className="j-hero">
          <Image className="j-hero-img" src="/images/hero.jpg" alt="" fill priority sizes="100vw" data-j-hero-img />
          <div className="j-hero-copy">
            <p className="j-tag" data-j-fade>{c.tag}</p>
            <h1 className="j-title" data-j-split>{c.title}</h1>
            <p className="j-lead" data-j-fade>{c.lead}</p>
          </div>
        </section>
        <Suspense fallback={<div className="j-posts-fallback" aria-hidden />}>
          <JournalPosts lang={lang} copy={c} />
        </Suspense>
        <Newsletter copy={c} />
      </main>
      <SiteFooter />
    </>
  );
}
