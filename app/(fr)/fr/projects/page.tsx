import { ProjectsView, projectsMetadata } from "@/components/projects/projects-page";

export const metadata = projectsMetadata("fr");

export default function Page() {
  return <ProjectsView lang="fr" />;
}
