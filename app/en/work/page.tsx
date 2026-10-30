import { WorkIndex, workMetadata } from "@/components/pages/work-index";

export const metadata = workMetadata("en");

export default function Page() {
  return <WorkIndex lang="en" />;
}
