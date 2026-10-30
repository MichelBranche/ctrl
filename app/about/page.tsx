import { AboutView, aboutMetadata } from "@/components/pages/about-page";

export const metadata = aboutMetadata("it");

export default function Page() {
  return <AboutView lang="it" />;
}
