import type { Metadata } from "next";
import { WebappView, webappMetadata } from "@/components/services/webapp-page";

export const metadata: Metadata = webappMetadata("it");

export default function Page() {
  return <WebappView lang="it" />;
}
