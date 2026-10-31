import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsCta } from "@/components/projects/cta";
import { projectsCopy } from "@/components/projects/projects-copy";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { websiteGroups, websitesInOrder } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import "./projects.css";
import "./websites.css";

export function websiteSlugs() {
  return websitesInOrder().map((p) => p.slug);
}

export function websiteMetadata(slug: string, lang: Locale): Metadata {
  const p = websitesInOrder().find((w) => w.slug === slug);
  if (!p) return {};
  const path = `/projects/websites/${p.slug}`;
  return {
    title: `${p.title[lang]} · ${projectsCopy[lang].sites.back}`,
    description: p.description?.[lang],
    alternates: { canonical: localize(path, lang), languages: { it: path, en: `/en${path}` } },
    openGraph: { images: [p.image as string] },
  };
}

export function WebsiteDetail({ slug, lang }: { slug: string; lang: Locale }) {
  const list = websitesInOrder();
  const i = list.findIndex((w) => w.slug === slug);
  if (i < 0) notFound();
  const p = list[i];
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const c = projectsCopy[lang];
  const s = c.sites;
  const group = websiteGroups.find((g) => g.slug === p.group)?.label[lang];
  const href = (x: string) => localize(`/projects/websites/${x}`, lang);
  const gallery = p.gallery ?? [];
  // First desktop view runs full width; the rest pair up in fixed-ratio boxes (no layout shift).
  const cls = (kind: string, n: number) => (kind === "desktop" ? (n === 0 ? "wd-shot-desktop" : "wd-shot-half") : `wd-shot-square wd-shot-${kind}`);

  return (
    <>
      <SiteHeader />
      <main className="p-root" data-motion-root>
        <section className="wd-hero">
          <div className="wd-crumbs">
            <Link href={localize("/projects/websites", lang)} className="p-back p-mono" data-p-fade>
              <PArrow className="p-arrow p-arrow-back" />
              {s.back}
            </Link>
          </div>
          <p className="p-tag p-mono" data-p-fade>{group}</p>
          <h1 className="wd-title" data-p-split>{p.title[lang]}</h1>
          <dl className="wd-facts p-mono" data-p-fade>
            <div><dt>{s.facts.category}</dt><dd>{group}</dd></div>
            <div><dt>{s.facts.place}</dt><dd>{p.place?.[lang] ?? p.client}</dd></div>
            {p.year ? <div><dt>{s.facts.year}</dt><dd>{p.year}</dd></div> : null}
            {p.author ? (
              <div>
                <dt>{s.facts.author}</dt>
                <dd>
                  <a href={p.author.url} target="_blank" rel="noopener noreferrer">
                    {p.author.name}
                    <span className="p-sr">{s.portfolioTab}</span>
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="wd-body">
            <div data-p-fade>
              {p.description ? <p className="wd-lead">{p.description[lang]}</p> : null}
              {p.tech?.length ? (
                <ul className="wd-tech p-mono" aria-label={s.facts.tech}>
                  {p.tech.map((t) => <li key={t}>{t}</li>)}
                </ul>
              ) : null}
            </div>
            <CtaLink href={p.url as string} external className="wd-live" data-p-fade>
              {s.live}
            </CtaLink>
          </div>
        </section>

        <ul className="wd-gallery" aria-label={s.galleryLabel}>
          {gallery.map((g, n) => {
            const full = n === 0;
            return (
              <li key={g.src} className={`wd-shot ${cls(g.kind, n)}`} data-p-card>
                <Image src={g.src} alt={`${p.title[lang]}, ${g.kind === "mobile" ? s.shotMobile : s.shotDesktop}`} fill
                  sizes={full ? "(max-width: 900px) 100vw, 90rem" : "(max-width: 900px) 100vw, 45rem"}
                  priority={full} />
                {g.kind !== "cover" ? <span className="wd-cap p-mono">{g.kind === "mobile" ? s.shotMobile : s.shotDesktop}</span> : null}
              </li>
            );
          })}
        </ul>

        <nav className="wd-nav" aria-label={s.back}>
          <Link href={href(prev.slug)}>
            <span className="wd-nav-k p-mono"><PArrow className="p-arrow p-arrow-back" />{s.prev}</span>
            <span className="wd-nav-t">{prev.title[lang]}</span>
          </Link>
          <Link href={href(next.slug)}>
            <span className="wd-nav-k p-mono">{s.next}<PArrow className="p-arrow" /></span>
            <span className="wd-nav-t">{next.title[lang]}</span>
          </Link>
        </nav>

        <ProjectsCta copy={c} href={localize("/contact", lang)} />
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
