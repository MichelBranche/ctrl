import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/content";
import { ArrowIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";

export function ProjectCard({
  project,
  index = 0,
}: {
  project: Project;
  index?: number;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article className="work-card" data-tilt>
      <Link href={`/work/${project.slug}`} className="work-card-link" data-cursor="View">
        <div className="work-media tilt-target">
          <div className="work-pan">
            {project.kind === "phone" ? (
              <div className="phone-scene">
                <div className="phone">
                  <div className="phone-screen">
                    <Wordmark />
                    <p>
                      Better
                      <br />
                      Digital
                      <br />
                      Products
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Image
                src={project.image ?? ""}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 40vw"
              />
            )}
          </div>
          <span className="work-no">{number}</span>
        </div>
        <div className="work-caption">
          <div>
            <h3>{project.name}</h3>
            <p>{project.meta}</p>
          </div>
          <ArrowIcon />
        </div>
      </Link>
    </article>
  );
}
