import type { Metadata } from "next";
import { SiteDocument } from "@/components/site-document";
import { dict } from "@/lib/i18n";
import { openGraph } from "@/lib/seo";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: dict.fr.meta.title, template: "%s | CTRL®" },
  description: dict.fr.meta.description,
  metadataBase: new URL("https://www.ctrlagency.dev"),
  openGraph: openGraph("fr"),
  twitter: { card: "summary_large_image" },
};

export default function FrenchLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="fr">{children}</SiteDocument>;
}
