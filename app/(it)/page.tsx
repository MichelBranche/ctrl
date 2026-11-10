import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home-page";
import { dict } from "@/lib/i18n";
import { alternates, openGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: dict.it.meta.title },
  description: dict.it.meta.description,
  alternates: alternates("/", "it"),
  openGraph: openGraph("it", { title: dict.it.meta.title, description: dict.it.meta.description }),
};

export default function Page() {
  return <HomePage lang="it" />;
}
