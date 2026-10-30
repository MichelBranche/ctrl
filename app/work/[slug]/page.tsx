import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Wordmark } from "@/components/wordmark";
import { getProject, projects } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Work" };
  return {
    title: project.name,
    description: `${project.name} — ${project.meta}. ${project.summary}`,
  };
}

export default function ProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="case" />}>
      <ProjectBody params={params} />
    </Suspense>
  );
}

async function ProjectBody({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <>
      <SiteHeader />
      <main className="case">
        <Link href="/work" className="text-link case-back">
          <ArrowIcon />
          All projects
        </Link>
        <p className="kicker">{project.meta}</p>
        <h1>{project.name}</h1>
        <div className="case-media">
          {project.kind === "phone" ? (
            <div className="phone-scene">
              <div className="phone case-device">
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
              priority
              sizes="(max-width: 900px) 100vw, 1100px"
            />
          )}
        </div>
        <p className="case-summary">{project.summary}</p>
      </main>
      <SiteFooter />
    </>
  );
}
