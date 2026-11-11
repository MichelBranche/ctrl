import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProjectsCta } from "@/components/projects/cta";
import { ProjectsBrowser, type CategoryCard } from "@/components/projects/projects-browser";
import { projectsCopy } from "@/components/projects/projects-copy";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { SecuritySection } from "@/components/security/security-section";
import { categoryPath, projectCategories } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, openGraph } from "@/lib/seo";
import "./projects.css";

export function projectsMetadata(lang: Locale): Metadata {
  const c = projectsCopy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates("/projects", lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription }),
  };
}

export function ProjectsView({ lang }: { lang: Locale }) {
  const c = projectsCopy[lang];
  const items: CategoryCard[] = projectCategories.map((cat) => ({
    slug: cat.slug,
    label: cat.label[lang],
    title: cat.title[lang],
    text: cat.text[lang],
    image: cat.image,
    href: localize(categoryPath(cat), lang),
  }));

  return (
    <>
      <SiteHeader />
      <main className="p-root" data-motion-root>
        <section className="p-hero">
          <span className="p-hero-frame" aria-hidden="true">
            <Image className="p-hero-img" src="/images/hero.jpg" alt="" fill priority sizes="(max-width: 760px) 100vw, 70vw" data-p-hero-img />
          </span>
          <div className="p-hero-copy">
            <p className="p-tag-hero p-mono" data-p-fade>{c.tag}</p>
            <h1 className="p-title" data-p-split>{c.title}</h1>
            <p className="p-lead" data-p-fade>
              {c.lead.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </p>
            <CtaLink href="#progetti" className="p-discover" data-p-fade>
              {c.all}
            </CtaLink>
          </div>
        </section>

        <ProjectsBrowser
          items={items}
          copy={{ all: c.all, filterLabel: c.filterLabel, filterAll: c.filterAll, viewLabel: c.viewLabel, gridView: c.gridView, listView: c.listView, open: c.open }}
        />
        <ProjectsCta copy={c} href={localize("/contact", lang)} />
        <SecuritySection lang={lang} variant="projects" />
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
