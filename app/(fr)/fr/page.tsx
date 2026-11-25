import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home-page";
import { dict } from "@/lib/i18n";
import { publicMeta } from "@/lib/seo";

export const metadata: Metadata = publicMeta("fr", {
  title: dict.fr.meta.title,
  description: dict.fr.meta.description,
  itPath: "/",
});

export default function Page() {
  return <HomePage lang="fr" />;
}
