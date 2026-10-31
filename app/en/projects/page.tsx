import { ProjectsView, projectsMetadata } from "@/components/projects/projects-page";

export const metadata = projectsMetadata("en");

export default function Page() {
  return <ProjectsView lang="en" />;
}
