import type { Metadata } from "next";
import { ProjectCard } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { projects } from "@/lib/content";
import { dict, type Locale } from "@/lib/i18n";

export function workMetadata(lang: Locale): Metadata {
  return { title: dict[lang].work.title, description: dict[lang].work.description };
}

export function WorkIndex({ lang }: { lang: Locale }) {
  const t = dict[lang].work;
  return (
    <>
      <SiteHeader />
      <main className="work work-index">
        <div className="work-head">
          <p className="kicker">{t.kicker}</p>
          <p className="work-note">{t.conceptNote}</p>
        </div>
        <div className="work-grid">
          {projects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} lang={lang} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
