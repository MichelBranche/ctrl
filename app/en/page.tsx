import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home-page";
import { dict } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: dict.en.meta.title },
  description: dict.en.meta.description,
  alternates: { canonical: "/en", languages: { it: "/", en: "/en" } },
};

export default function Page() {
  return <HomePage lang="en" />;
}
