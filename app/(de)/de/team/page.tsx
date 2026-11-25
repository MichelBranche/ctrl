import { TeamView, teamMetadata } from "@/components/pages/team-page";

export const metadata = teamMetadata("de");

export default function Page() {
  return <TeamView lang="de" />;
}
