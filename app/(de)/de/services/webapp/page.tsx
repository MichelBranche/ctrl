import type { Metadata } from "next";
import { WebappView, webappMetadata } from "@/components/services/webapp-page";

export const metadata: Metadata = webappMetadata("de");

export default function Page() {
  return <WebappView lang="de" />;
}
