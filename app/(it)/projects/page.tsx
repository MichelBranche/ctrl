import { ProjectsView, projectsMetadata } from "@/components/projects/projects-page";

export const metadata = projectsMetadata("it");

export default function Page() {
  return <ProjectsView lang="it" />;
}
