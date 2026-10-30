import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home-page";
import { dict } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: dict.it.meta.title },
  description: dict.it.meta.description,
  alternates: { canonical: "/", languages: { it: "/", en: "/en" } },
};

export default function Page() {
  return <HomePage lang="it" />;
}
