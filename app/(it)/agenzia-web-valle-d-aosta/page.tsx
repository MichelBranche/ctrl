import type { Metadata } from "next";
import { LocalView, localMetadata } from "@/components/pages/local-page";

export const metadata: Metadata = localMetadata("it");

export default function Page() {
  return <LocalView lang="it" />;
}
