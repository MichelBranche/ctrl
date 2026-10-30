import type { Metadata } from "next";
import { ProjectCard } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { projects } from "@/lib/content";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected work by CTRL® — identity, digital products and visual communication.",
};

export default function WorkPage() {
  return (
    <>
      <SiteHeader />
      <main className="work work-index">
        <div className="work-head">
          <p className="kicker">Selected work</p>
        </div>
        <div className="work-grid">
          {projects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
