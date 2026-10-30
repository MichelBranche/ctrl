import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { ProjectTile } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getProject } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";

export function projectMetadata(slug: string, lang: Locale): Metadata {
  const project = getProject(slug);
  if (!project) return { title: dict[lang].work.title };
  return {
    title: project.name,
    description: `${project.name} | ${project.meta[lang]}. ${project.summary[lang]}`,
  };
}

export function ProjectView({ slug, lang }: { slug: string; lang: Locale }) {
  const project = getProject(slug);
  if (!project) notFound();
  const t = dict[lang].work;

  return (
    <>
      <SiteHeader />
      <main className="case">
        <Link href={localize("/work", lang)} className="text-link case-back">
          <ArrowIcon />
          {t.back}
        </Link>
        <p className="kicker">{project.meta[lang]}</p>
        <h1>{project.name}</h1>
        <div className="case-media">
          {project.image ? (
            <Image
              src={project.image}
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 1100px"
            />
          ) : (
            <ProjectTile project={project} lang={lang} />
          )}
        </div>
        <aside className="sub-aside case-aside">
          <span className="sub-aside-index">{project.name}</span>
          <span className="kicker">{project.meta[lang]}</span>
        </aside>
        <div className="sub-main case-body">
          <p className="case-summary">{project.summary[lang]}</p>
          <p className="work-note">{t.conceptNote}</p>
          <a
            className="cta-button case-live"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{t.visit}</span>
            <ArrowIcon />
          </a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
