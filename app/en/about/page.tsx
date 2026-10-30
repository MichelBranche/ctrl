import { AboutView, aboutMetadata } from "@/components/pages/about-page";

export const metadata = aboutMetadata("en");

export default function Page() {
  return <AboutView lang="en" />;
}
