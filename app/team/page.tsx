import { TeamView, teamMetadata } from "@/components/pages/team-page";

export const metadata = teamMetadata("it");

export default function Page() {
  return <TeamView lang="it" />;
}
