import { ProjectsView, projectsMetadata } from "@/components/projects/projects-page";

export const metadata = projectsMetadata("de");

export default function Page() {
  return <ProjectsView lang="de" />;
}
