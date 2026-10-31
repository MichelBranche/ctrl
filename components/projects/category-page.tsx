import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsCta } from "@/components/projects/cta";
import { projectsCopy } from "@/components/projects/projects-copy";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { WebsitesBrowser, type SiteRow } from "@/components/projects/websites-browser";
import { getProjectCategory, projectCategories, projectsIn, websiteGroups, websitesInOrder, type Project } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import "./projects.css";
import "./websites.css";

export function categoryMetadata(slug: string, lang: Locale): Metadata {
  const cat = getProjectCategory(slug);
  if (!cat) return {};
  const path = `/projects/${cat.slug}`;
  return {
    title: projectsCopy[lang].categoryMeta(cat.label[lang]),
    description: cat.slug === "websites" ? projectsCopy[lang].sites.metaDescription : cat.intro[lang],
    alternates: { canonical: localize(path, lang), languages: { it: path, en: `/en${path}` } },
    openGraph: { images: [cat.image] },
  };
}

function WorkCard({ work, lang }: { work: Project; lang: Locale }) {
  const c = projectsCopy[lang];
  const inner = (
    <>
      <span className="p-work-media" aria-hidden="true">
        {work.image ? (
          <span className="p-media-in" data-p-parallax>
            <Image className="p-img" src={work.image} alt="" fill sizes="(max-width: 760px) 100vw, 50vw" />
          </span>
        ) : (
          <span className="p-work-type">{work.client}</span>
        )}
      </span>
      <span className="p-work-body">
        <span className="p-work-meta p-mono">
          <span>
            {c.client}: {work.client}
          </span>
          {work.year ? <span>{work.year}</span> : null}
        </span>
        <span className="p-work-title">{work.title[lang]}</span>
        {work.url ? (
          <span className="p-work-go p-mono">
            {c.visit} <PArrow className="p-arrow p-card-arrow" />
            <span className="p-sr">{c.newTab}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <li data-p-card>
      {work.url ? (
        <a href={work.url} target="_blank" rel="noopener noreferrer" className="p-work">
          {inner}
        </a>
      ) : (
        <div className="p-work">{inner}</div>
      )}
    </li>
  );
}

/** /projects/websites: typographic list filterable by sector; each row opens the internal project page. */
function WebsitesSection({ lang }: { lang: Locale }) {
  const c = projectsCopy[lang];
  const label = (slug?: string) => websiteGroups.find((g) => g.slug === slug)?.label[lang] ?? "";
  const items: SiteRow[] = websitesInOrder().map((w) => ({
    slug: w.slug,
    href: localize(`/projects/websites/${w.slug}`, lang),
    group: w.group ?? "",
    groupLabel: label(w.group),
    title: w.title[lang],
    place: w.place?.[lang] ?? w.client,
    year: w.year,
    image: w.image as string,
    author: w.author,
  }));
  const groups = websiteGroups.filter((g) => items.some((i) => i.group === g.slug)).map((g) => ({ slug: g.slug, label: g.label[lang] }));
  return (
    <WebsitesBrowser
      items={items}
      groups={groups}
      copy={{
        filterLabel: c.sites.filterLabel,
        filterAll: c.filterAll,
        madeBy: c.sites.madeBy,
        portfolioTab: c.sites.portfolioTab,
        open: c.sites.open,
      }}
    />
  );
}

export function CategoryView({ slug, lang }: { slug: string; lang: Locale }) {
  const cat = getProjectCategory(slug);
  if (!cat) notFound();
  const c = projectsCopy[lang];
  const works = projectsIn(cat.slug);
  const others = projectCategories.filter((item) => item.slug !== cat.slug);
  const contact = localize("/contact", lang);

  return (
    <>
      <SiteHeader />
      <main className="p-root" data-motion-root>
        <section className="p-hero p-hero-cat">
          <span className="p-hero-frame p-hero-frame-cat" aria-hidden="true">
            <Image className="p-hero-img" src={cat.image} alt="" fill priority sizes="(max-width: 760px) 100vw, 75vw" data-p-hero-img />
          </span>
          <div className="p-hero-copy">
            <Link href={localize("/projects", lang)} className="p-back p-mono" data-p-fade>
              <PArrow className="p-arrow p-arrow-back" />
              {c.back}
            </Link>
            <p className="p-tag p-mono" data-p-fade>{cat.label[lang]}</p>
            <h1 className="p-title p-title-cat" data-p-split aria-label={cat.title[lang].join(" ")}>
              {cat.title[lang].map((line) => (
                <span key={line}>{line} </span>
              ))}
            </h1>
            <p className="p-lead" data-p-fade>{cat.intro[lang]}</p>
            {works.length ? <p className="p-count p-mono" data-p-fade>{c.count(works.length)}</p> : null}
          </div>
        </section>

        <section className="p-works" aria-label={c.worksLabel}>
          {cat.slug === "websites" && works.length ? (
            <WebsitesSection lang={lang} />
          ) : works.length ? (
            <ul className="p-work-grid">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} lang={lang} />
              ))}
            </ul>
          ) : (
            <div className="p-empty" data-p-fade-scroll>
              <span className="p-empty-mark" aria-hidden="true">
                <i />
              </span>
              <p className="p-kicker p-mono">{c.updatingKicker}</p>
              <h2 className="p-empty-title">{c.emptyTitle}</h2>
              <p className="p-empty-text">{c.emptyText}</p>
              <Link href={contact} className="p-btn p-btn-fill" data-magnetic>
                <span className="p-mono">{c.emptyCta}</span>
                <PArrow />
              </Link>
            </div>
          )}
        </section>

        <section className="p-others" aria-labelledby="p-others-title">
          <h2 className="p-kicker p-mono" id="p-others-title" data-p-fade-scroll>{c.others}</h2>
          <ul className="p-others-grid">
            {others.map((item) => (
              <li key={item.slug}>
                <Link href={localize(`/projects/${item.slug}`, lang)} className="p-other" data-p-card>
                  <span className="p-other-media" aria-hidden="true">
                    <Image className="p-img" src={item.image} alt="" fill sizes="(max-width: 760px) 50vw, 20vw" />
                  </span>
                  <span className="p-other-label p-mono">
                    {item.label[lang]}
                    <PArrow className="p-arrow p-card-arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ProjectsCta copy={c} href={contact} />
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
