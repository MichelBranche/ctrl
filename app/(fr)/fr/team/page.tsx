import { TeamView, teamMetadata } from "@/components/pages/team-page";

export const metadata = teamMetadata("fr");

export default function Page() {
  return <TeamView lang="fr" />;
}
