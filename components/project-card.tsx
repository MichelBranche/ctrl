import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/content";
import { TiltCard } from "@/components/tilt-card";
import { ArrowIcon } from "@/components/icons";
import { dict, localize, type Locale } from "@/lib/i18n";

export function ProjectTile({ project, lang }: { project: Project; lang: Locale }) {
  return (
    <div className="type-tile">
      <span className="type-tile-tag">{dict[lang].work.concept}</span>
      <strong>{project.name}</strong>
      <span className="type-tile-meta">
        {project.place[lang]} | {project.url.replace("https://", "")}
      </span>
    </div>
  );
}

export function ProjectCard({
  project,
  index = 0,
  lang,
}: {
  project: Project;
  index?: number;
  lang: Locale;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article className="work-card">
      <Link
        href={localize(`/work/${project.slug}`, lang)}
        className="work-card-link"
      >
        <TiltCard>
          <div className="work-media">
            <div className="work-pan">
              {project.image ? (
                <Image src={project.image} alt="" fill sizes="(max-width: 900px) 100vw, 40vw" />
              ) : (
                <ProjectTile project={project} lang={lang} />
              )}
            </div>
            <span className="work-no">{number}</span>
          </div>
          <div className="work-caption">
            <div>
              <h3>{project.name}</h3>
              <p>{project.meta[lang]}</p>
            </div>
            <ArrowIcon />
          </div>
        </TiltCard>
      </Link>
    </article>
  );
}
