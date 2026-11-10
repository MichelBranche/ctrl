import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home-page";
import { dict } from "@/lib/i18n";
import { alternates, openGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: dict.en.meta.title },
  description: dict.en.meta.description,
  alternates: alternates("/", "en"),
  openGraph: openGraph("en", { title: dict.en.meta.title, description: dict.en.meta.description }),
};

export default function Page() {
  return <HomePage lang="en" />;
}
