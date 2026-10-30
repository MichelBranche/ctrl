import { TeamView, teamMetadata } from "@/components/pages/team-page";

export const metadata = teamMetadata("en");

export default function Page() {
  return <TeamView lang="en" />;
}
