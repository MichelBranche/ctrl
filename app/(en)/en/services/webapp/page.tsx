import type { Metadata } from "next";
import { WebappView, webappMetadata } from "@/components/services/webapp-page";

export const metadata: Metadata = webappMetadata("en");

export default function Page() {
  return <WebappView lang="en" />;
}
